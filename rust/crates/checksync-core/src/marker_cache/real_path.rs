//! Resolving the links in a path, as Node.js's `fs.realpathSync` does.

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::node_path::node_normalize;

/// Returns a path with every link in it resolved, as Node.js's `fs.realpathSync` does.
///
/// The path is normalized as text first, so `.` and `..` are worked out
/// without looking at the file system. Then each name is checked in turn,
/// and a name that's a link is replaced by its target before carrying on.
/// Names that aren't links keep the spelling they were given: unlike
/// [`fs::canonicalize`], this doesn't change their case, expand Windows
/// short names, or swap a mapped drive for the network path it reaches.
///
/// # Errors
///
/// Returns the error for a name that doesn't exist, or for a link that's
/// broken or part of a loop. A path that goes through more than 40 links
/// fails with the same message as a loop, where Node.js would never finish.
pub(super) fn real_path(path: &Path) -> io::Result<PathBuf> {
    let mut path = resolve_as_text(path);
    #[cfg(windows)]
    {
        // Node.js checks that the root exists on Windows.
        if let Some(root) = path.ancestors().last() {
            fs::symlink_metadata(root)?;
        }
    }
    let mut links_followed = 0;
    'resolve: loop {
        let components: Vec<Component> = path.components().collect();
        let mut current = PathBuf::new();
        for (index, component) in components.iter().enumerate() {
            current.push(component);
            if !matches!(component, Component::Normal(_)) {
                continue;
            }
            if !fs::symlink_metadata(&current)?.file_type().is_symlink() {
                continue;
            }
            // Following the link fails for one that's broken or in a loop,
            // as Node.js's `stat` call does, before the link is read.
            let target = fs::metadata(&current).and_then(|_| fs::read_link(&current))?;
            let target = strip_verbatim_prefix(target);
            // A link always has a parent folder, which its target is relative to.
            let mut next = current.clone();
            next.pop();
            next.push(target);
            next.extend(&components[index + 1..]);
            links_followed += 1;
            if links_followed > MAX_LINKS {
                return Err(io::Error::other("Too many levels of symbolic links"));
            }
            path = resolve_as_text(&next);
            continue 'resolve;
        }
        return Ok(path);
    }
}

/// How many links one path may go through before resolving it gives up.
///
/// Node.js has no limit, and never finishes a path whose links lead back to
/// themselves only when `..` is worked out as text, such as a link to
/// `l/../link` where `l` is a link to a folder. Following a link fails for an
/// ordinary loop, so the limit only stops paths that Node.js never resolves.
/// 40 is Linux's limit for the links a single path may go through.
const MAX_LINKS: usize = 40;

/// Works out `.` and `..` in a path as text, and drops a trailing separator,
/// as Node.js's `path.resolve` does for an absolute path.
fn resolve_as_text(path: &Path) -> PathBuf {
    node_normalize(path).components().collect()
}

/// Removes the `\\?\` prefix Windows can give a link's target, which Node.js doesn't show.
#[cfg(windows)]
fn strip_verbatim_prefix(path: PathBuf) -> PathBuf {
    use std::path::Prefix;

    let mut components = path.components();
    let start = match components.next() {
        Some(Component::Prefix(prefix)) => match prefix.kind() {
            Prefix::VerbatimDisk(letter) => format!("{}:", char::from(letter)),
            Prefix::VerbatimUNC(server, share) => {
                format!(
                    r"\\{}\{}",
                    server.to_string_lossy(),
                    share.to_string_lossy()
                )
            }
            _ => return path,
        },
        _ => return path,
    };
    let mut stripped = PathBuf::from(start);
    stripped.extend(components);
    stripped
}

/// Returns the path as it is: only Windows prefixes link targets.
#[cfg(not(windows))]
fn strip_verbatim_prefix(path: PathBuf) -> PathBuf {
    path
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use tempfile::TempDir;

    use super::real_path;

    /// Creates a folder whose own path has no links in it.
    fn folder() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = fs::canonicalize(dir.path()).unwrap();
        (dir, path)
    }

    #[test]
    fn keeps_a_path_without_links() {
        // Arrange
        let (_dir, root) = folder();
        fs::write(root.join("a.js"), "").unwrap();

        // Act
        let result = real_path(&root.join("a.js")).unwrap();

        // Assert
        assert_eq!(result, root.join("a.js"));
    }

    #[test]
    fn works_out_parent_folders_as_text() {
        // Arrange
        let (_dir, root) = folder();
        fs::write(root.join("a.js"), "").unwrap();

        // Act
        let result = real_path(&root.join("missing").join("..").join("a.js")).unwrap();

        // Assert
        assert_eq!(result, root.join("a.js"));
    }

    #[test]
    fn drops_a_trailing_separator() {
        // Arrange
        let (_dir, root) = folder();
        fs::create_dir(root.join("sub")).unwrap();
        let mut given = root.join("sub").into_os_string();
        given.push(std::path::MAIN_SEPARATOR_STR);

        // Act
        let result = real_path(std::path::Path::new(&given)).unwrap();

        // Assert
        assert_eq!(result, root.join("sub"));
    }

    #[test]
    fn fails_for_a_missing_name() {
        // Arrange
        let (_dir, root) = folder();

        // Act
        let result = real_path(&root.join("missing.js"));

        // Assert
        assert_eq!(result.unwrap_err().kind(), std::io::ErrorKind::NotFound);
    }

    #[cfg(unix)]
    mod links {
        use std::fs;
        use std::os::unix::fs::symlink;

        use super::{folder, real_path};

        #[test]
        fn follows_a_link_to_a_file() {
            // Arrange
            let (_dir, root) = folder();
            fs::write(root.join("a.js"), "").unwrap();
            symlink(root.join("a.js"), root.join("link.js")).unwrap();

            // Act
            let result = real_path(&root.join("link.js")).unwrap();

            // Assert
            assert_eq!(result, root.join("a.js"));
        }

        #[test]
        fn follows_a_relative_link() {
            // Arrange
            let (_dir, root) = folder();
            fs::create_dir(root.join("sub")).unwrap();
            fs::write(root.join("a.js"), "").unwrap();
            symlink("../a.js", root.join("sub/link.js")).unwrap();

            // Act
            let result = real_path(&root.join("sub/link.js")).unwrap();

            // Assert
            assert_eq!(result, root.join("a.js"));
        }

        #[test]
        fn follows_a_link_to_a_folder_partway_along() {
            // Arrange
            let (_dir, root) = folder();
            fs::create_dir(root.join("real")).unwrap();
            fs::write(root.join("real/a.js"), "").unwrap();
            symlink(root.join("real"), root.join("linked")).unwrap();

            // Act
            let result = real_path(&root.join("linked/a.js")).unwrap();

            // Assert
            assert_eq!(result, root.join("real/a.js"));
        }

        #[test]
        fn follows_a_chain_of_links() {
            // Arrange
            let (_dir, root) = folder();
            fs::write(root.join("a.js"), "").unwrap();
            symlink("a.js", root.join("one.js")).unwrap();
            symlink("one.js", root.join("two.js")).unwrap();

            // Act
            let result = real_path(&root.join("two.js")).unwrap();

            // Assert
            assert_eq!(result, root.join("a.js"));
        }

        #[test]
        fn fails_for_a_broken_link() {
            // Arrange
            let (_dir, root) = folder();
            symlink(root.join("missing.js"), root.join("link.js")).unwrap();

            // Act
            let result = real_path(&root.join("link.js"));

            // Assert
            assert_eq!(result.unwrap_err().kind(), std::io::ErrorKind::NotFound);
        }

        #[test]
        fn fails_for_a_loop_of_links() {
            // Arrange
            let (_dir, root) = folder();
            symlink("two.js", root.join("one.js")).unwrap();
            symlink("one.js", root.join("two.js")).unwrap();

            // Act
            let result = real_path(&root.join("one.js"));

            // Assert
            assert!(
                result
                    .unwrap_err()
                    .to_string()
                    .starts_with("Too many levels of symbolic links")
            );
        }

        #[test]
        fn works_out_parent_folders_after_a_linked_folder_as_text() {
            // Arrange
            let (_dir, root) = folder();
            fs::create_dir_all(root.join("real/inner")).unwrap();
            fs::create_dir(root.join("deep")).unwrap();
            fs::write(root.join("deep/l"), "").unwrap();
            // Following `climb` has to succeed on the file system first, where
            // `linked/..` is `real`, before its target is worked out as text.
            fs::create_dir(root.join("real/deep")).unwrap();
            fs::write(root.join("real/deep/l"), "").unwrap();
            symlink(root.join("real/inner"), root.join("linked")).unwrap();
            symlink("linked/../deep/l", root.join("climb")).unwrap();

            // Act
            let result = real_path(&root.join("climb")).unwrap();

            // Assert
            assert_eq!(result, root.join("deep/l"));
        }

        #[test]
        fn drops_a_trailing_separator_from_a_link_target() {
            // Arrange
            let (_dir, root) = folder();
            fs::create_dir(root.join("real")).unwrap();
            symlink("real/", root.join("trail")).unwrap();

            // Act
            let result = real_path(&root.join("trail")).unwrap();

            // Assert
            assert_eq!(result, root.join("real"));
        }

        #[test]
        fn gives_up_on_links_that_only_loop_as_text() {
            // Arrange
            let (_dir, root) = folder();
            fs::create_dir_all(root.join("deep/q")).unwrap();
            fs::write(root.join("deep/hit"), "").unwrap();
            symlink("deep/q", root.join("dq")).unwrap();
            symlink("dq/../hit", root.join("hit")).unwrap();

            // Act
            let result = real_path(&root.join("hit"));

            // Assert
            assert!(
                result
                    .unwrap_err()
                    .to_string()
                    .starts_with("Too many levels of symbolic links")
            );
        }
    }

    #[cfg(windows)]
    mod verbatim {
        use std::path::PathBuf;

        use super::super::strip_verbatim_prefix;

        #[test]
        fn strips_a_verbatim_disk_prefix() {
            // Arrange
            let path = PathBuf::from(r"\\?\C:\repo\a.js");

            // Act
            let result = strip_verbatim_prefix(path);

            // Assert
            assert_eq!(result, PathBuf::from(r"C:\repo\a.js"));
        }

        #[test]
        fn strips_a_verbatim_unc_prefix() {
            // Arrange
            let path = PathBuf::from(r"\\?\UNC\server\share\a.js");

            // Act
            let result = strip_verbatim_prefix(path);

            // Assert
            assert_eq!(result, PathBuf::from(r"\\server\share\a.js"));
        }

        #[test]
        fn keeps_a_path_without_a_verbatim_prefix() {
            // Arrange
            let path = PathBuf::from(r"C:\repo\a.js");

            // Act
            let result = strip_verbatim_prefix(path);

            // Assert
            assert_eq!(result, PathBuf::from(r"C:\repo\a.js"));
        }
    }
}
