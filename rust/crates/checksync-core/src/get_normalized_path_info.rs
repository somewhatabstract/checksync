use std::path::{Path, PathBuf};

use crate::node_normalize::node_normalize;
use crate::os_separators::os_separators;
use crate::types::{NormalizedPathInfo, TargetType};

/// Resolve the target written in a sync-start tag.
///
/// A target containing `://` is a URL: it's returned as written, and always
/// counts as existing, since checksync doesn't fetch URLs. Any other target
/// is a path relative to the root, unless it starts at a root, which on
/// Windows includes a path with no drive, such as `\shared\x.js`. A
/// relative target is joined to the root as Node.js's `path.join` would, as
/// text, so an empty target is the root itself. The result is normalized as
/// Node.js's `path.normalize` would, and it exists only if it's a file. A
/// folder, or a symbolic link even to a file, doesn't count, as in
/// checksync's JavaScript implementation, which checks with `lstat`.
///
/// # Arguments
///
/// * `root_path` - The absolute path of the root folder.
/// * `target` - The target as written in the tag.
///
/// # Returns
///
/// The resolved path or URL, whether it exists, and whether it's local.
#[must_use]
pub fn get_normalized_path_info(root_path: &Path, target: &str) -> NormalizedPathInfo {
    if target.contains("://") {
        return NormalizedPathInfo {
            path: target.to_owned(),
            exists: true,
            kind: TargetType::Remote,
        };
    }
    let target = Path::new(target);
    // `has_root` rather than `is_absolute`: on Windows, Node.js counts a path
    // like `\shared` as absolute, but Rust also needs a drive.
    let absolute = if target.has_root() {
        target.to_path_buf()
    } else if target.as_os_str().is_empty() {
        root_path.to_path_buf()
    } else {
        // Not `Path::join`, which adds a trailing separator for an empty
        // target and, on Windows, replaces the root with a target like `C:x`.
        // The target gets the platform's separators first: under a Windows
        // `\\?\` root, only `\` separates segments.
        let mut joined = root_path.as_os_str().to_owned();
        joined.push(std::path::MAIN_SEPARATOR_STR);
        joined.push(os_separators(&target.to_string_lossy()));
        PathBuf::from(joined)
    };
    let path = os_separators(&node_normalize(&absolute).to_string_lossy());
    let exists = std::fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.is_file());
    NormalizedPathInfo {
        path,
        exists,
        kind: TargetType::Local,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::get_normalized_path_info;
    use crate::types::{NormalizedPathInfo, TargetType};

    #[test]
    fn treats_a_url_as_an_existing_remote_target() {
        // Arrange
        let root = TempDir::new().unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "https://example.com/a");

        // Assert
        assert_eq!(
            result,
            NormalizedPathInfo {
                path: "https://example.com/a".to_owned(),
                exists: true,
                kind: TargetType::Remote,
            }
        );
    }

    #[test]
    fn resolves_a_relative_target_against_the_root() {
        // Arrange
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("b")).unwrap();
        fs::write(root.path().join("b/c.js"), "").unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "a/../b/./c.js");

        // Assert
        assert_eq!(
            result,
            NormalizedPathInfo {
                path: root.path().join("b").join("c.js").display().to_string(),
                exists: true,
                kind: TargetType::Local,
            }
        );
    }

    #[test]
    fn keeps_an_absolute_target() {
        // Arrange
        let root = TempDir::new().unwrap();
        let other = TempDir::new().unwrap();
        let file = other.path().join("c.js");
        fs::write(&file, "").unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), &file.display().to_string());

        // Assert
        assert_eq!(result.path, file.display().to_string());
    }

    #[cfg(windows)]
    #[test]
    fn keeps_a_target_that_starts_at_the_root_of_the_drive() {
        // Arrange
        let root = TempDir::new().unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "/shared/x.js");

        // Assert
        assert_eq!(result.path, r"\shared\x.js");
    }

    #[cfg(windows)]
    #[test]
    fn joins_a_target_with_a_drive_but_no_root_to_the_root() {
        // Arrange
        let root = TempDir::new().unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "C:x.js");

        // Assert
        assert_eq!(result.path, format!(r"{}\C:x.js", root.path().display()));
    }

    #[cfg(windows)]
    #[test]
    fn resolves_dot_dot_under_a_verbatim_root() {
        // Arrange
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("b.js"), "").unwrap();
        let root = std::path::PathBuf::from(format!(r"\\?\{}", dir.path().display()));

        // Act
        let result = get_normalized_path_info(&root, "a/../b.js");

        // Assert
        assert_eq!(
            result,
            NormalizedPathInfo {
                path: format!(r"{}\b.js", root.display()),
                exists: true,
                kind: TargetType::Local,
            }
        );
    }

    #[test]
    fn resolves_an_empty_target_to_the_root() {
        // Arrange
        let root = TempDir::new().unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "");

        // Assert
        assert_eq!(result.path, root.path().display().to_string());
    }

    #[test]
    fn reports_a_missing_file_as_not_existing() {
        // Arrange
        let root = TempDir::new().unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "missing.js");

        // Assert
        assert!(!result.exists);
    }

    #[test]
    fn reports_a_folder_as_not_existing() {
        // Arrange
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("folder")).unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "folder");

        // Assert
        assert!(!result.exists);
    }

    #[cfg(unix)]
    #[test]
    fn reports_a_symbolic_link_to_a_file_as_not_existing() {
        // Arrange
        let root = TempDir::new().unwrap();
        fs::write(root.path().join("real.js"), "").unwrap();
        std::os::unix::fs::symlink(root.path().join("real.js"), root.path().join("link.js"))
            .unwrap();

        // Act
        let result = get_normalized_path_info(root.path(), "link.js");

        // Assert
        assert!(!result.exists);
    }
}
