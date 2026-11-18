//! Finding the root folder, and paths relative to it or the working folder.

use std::io;
use std::path::{Path, PathBuf};

use crate::node_path::node_relative;
use crate::types::RootMarkerError;

/// Makes an absolute file path relative to the root folder it's under.
///
/// The root is the closest folder at or above the file with the root marker
/// (see [`closesdir`]), which is `marker`, or [`DEFAULT_ROOT_MARKER`] when
/// that's `None`. The result is worked out as Node.js's `path.relative`
/// would, so `.`, `..` and repeated separators in the file path are resolved
/// as text, and it uses the platform's separators. A path that's already
/// relative is returned as it is.
///
/// # Errors
///
/// Returns [`RootMarkerError::NotFound`] if no folder above the file has the
/// marker.
pub fn root_relative_path(
    file_path: &Path,
    marker: Option<&str>,
) -> Result<PathBuf, RootMarkerError> {
    if !file_path.is_absolute() {
        return Ok(file_path.to_path_buf());
    }
    let root = closesdir(file_path, marker.unwrap_or(DEFAULT_ROOT_MARKER))?;
    // Both paths are absolute, so the folder relative paths would be
    // resolved against is never used.
    Ok(node_relative(&root, &root, file_path))
}

/// Makes a path relative to the current working folder.
///
/// This is Node.js's `path.relative(process.cwd(), file_path)`, which
/// checksync uses to show paths in its messages.
///
/// # Errors
///
/// Returns any error from reading the current working folder.
pub fn cwd_relative_path(file_path: &Path) -> io::Result<PathBuf> {
    std::env::current_dir().map(|cwd| node_relative(&cwd, &cwd, file_path))
}

/// The root marker checksync looks for when none is configured.
pub const DEFAULT_ROOT_MARKER: &str = "package.json";

/// Finds the closest folder at or above a path that contains a root marker.
///
/// The search checks `from` itself, then each folder above it, up to the
/// file system root, and returns the first folder that contains `marker`.
/// `from` is an absolute path to a folder, or to a file whose folders are
/// searched. The marker is the name of a file or a folder. This matches
/// `closesdir` from the `ancesdir` package, which checksync's JavaScript
/// implementation uses.
///
/// # Errors
///
/// Returns [`RootMarkerError::RelativeStart`] if `from` isn't absolute, and
/// [`RootMarkerError::NotFound`] if no folder up to the root has the marker.
pub fn closesdir(from: &Path, marker: &str) -> Result<PathBuf, RootMarkerError> {
    if !from.is_absolute() {
        return Err(RootMarkerError::RelativeStart {
            from: from.to_path_buf(),
        });
    }
    let mut folder = Some(from);
    while let Some(candidate) = folder {
        if candidate.join(marker).exists() {
            return Ok(candidate.to_path_buf());
        }
        folder = candidate.parent();
    }
    Err(RootMarkerError::NotFound {
        marker: marker.to_owned(),
        from: from.to_path_buf(),
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::{closesdir, cwd_relative_path, root_relative_path};
    use crate::types::RootMarkerError;

    #[test]
    fn makes_an_absolute_path_relative_to_its_root() {
        // Arrange
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/b")).unwrap();
        fs::write(dir.path().join("a/.root"), "").unwrap();
        let file = dir.path().join("a/b/file.js");

        // Act
        let result = root_relative_path(&file, Some(".root"));

        // Assert
        assert_eq!(result, Ok(PathBuf::from("b").join("file.js")));
    }

    #[test]
    fn resolves_dot_segments_in_the_file_path() {
        // Arrange
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/b/c")).unwrap();
        fs::write(dir.path().join("a/.root"), "").unwrap();
        let file = dir.path().join("a/b/./c/../file.js");

        // Act
        let result = root_relative_path(&file, Some(".root"));

        // Assert
        assert_eq!(result, Ok(PathBuf::from("b").join("file.js")));
    }

    #[test]
    fn resolves_repeated_separators_in_the_file_path() {
        // Arrange
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/b")).unwrap();
        fs::write(dir.path().join("a/.root"), "").unwrap();
        let file = PathBuf::from(format!(
            "{}{sep}a{sep}{sep}b{sep}{sep}file.js",
            dir.path().display(),
            sep = std::path::MAIN_SEPARATOR
        ));

        // Act
        let result = root_relative_path(&file, Some(".root"));

        // Assert
        assert_eq!(result, Ok(PathBuf::from("b").join("file.js")));
    }

    #[test]
    fn uses_package_json_when_no_marker_is_given() {
        // Arrange
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/b")).unwrap();
        fs::write(dir.path().join("a/package.json"), "{}").unwrap();
        let file = dir.path().join("a/b/file.js");

        // Act
        let result = root_relative_path(&file, None);

        // Assert
        assert_eq!(result, Ok(PathBuf::from("b").join("file.js")));
    }

    #[test]
    fn returns_a_relative_path_unchanged() {
        // Arrange
        let file = Path::new("b/file.js");

        // Act
        let result = root_relative_path(file, Some(".root"));

        // Assert
        assert_eq!(result, Ok(PathBuf::from("b/file.js")));
    }

    #[test]
    fn reports_a_missing_root() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("file.js");
        let marker = "no-such-marker-checksync-test";

        // Act
        let result = root_relative_path(&file, Some(marker));

        // Assert
        assert_eq!(
            result,
            Err(RootMarkerError::NotFound {
                marker: marker.to_owned(),
                from: file,
            })
        );
    }

    #[test]
    fn makes_a_path_below_the_working_folder_relative() {
        // Arrange
        let file = std::env::current_dir().unwrap().join("a").join("b.js");

        // Act
        let result = cwd_relative_path(&file).unwrap();

        // Assert
        assert_eq!(result, Path::new("a").join("b.js"));
    }

    /// Creates a temporary folder tree of `a/b/c` with `marker` in `a`.
    fn tree_with_marker_in_a(marker: &str) -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/b/c")).unwrap();
        fs::write(dir.path().join("a").join(marker), "").unwrap();
        dir
    }

    #[test]
    fn finds_the_marker_in_the_starting_folder() {
        // Arrange
        let dir = tree_with_marker_in_a(".root");
        let from = dir.path().join("a");

        // Act
        let result = closesdir(&from, ".root");

        // Assert
        assert_eq!(result, Ok(dir.path().join("a")));
    }

    #[test]
    fn finds_the_marker_in_a_folder_above() {
        // Arrange
        let dir = tree_with_marker_in_a(".root");
        let from = dir.path().join("a/b/c");

        // Act
        let result = closesdir(&from, ".root");

        // Assert
        assert_eq!(result, Ok(dir.path().join("a")));
    }

    #[test]
    fn searches_from_a_file_s_folder() {
        // Arrange
        let dir = tree_with_marker_in_a(".root");
        let from = dir.path().join("a/b/file.js");
        fs::write(&from, "").unwrap();

        // Act
        let result = closesdir(&from, ".root");

        // Assert
        assert_eq!(result, Ok(dir.path().join("a")));
    }

    #[test]
    fn finds_the_closest_of_several_markers() {
        // Arrange
        let dir = tree_with_marker_in_a(".root");
        fs::write(dir.path().join("a/b/.root"), "").unwrap();
        let from = dir.path().join("a/b/c");

        // Act
        let result = closesdir(&from, ".root");

        // Assert
        assert_eq!(result, Ok(dir.path().join("a/b")));
    }

    #[test]
    fn accepts_a_folder_as_the_marker() {
        // Arrange
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/.git")).unwrap();
        fs::create_dir_all(dir.path().join("a/b")).unwrap();
        let from = dir.path().join("a/b");

        // Act
        let result = closesdir(&from, ".git");

        // Assert
        assert_eq!(result, Ok(dir.path().join("a")));
    }

    #[test]
    fn reports_a_missing_marker() {
        // Arrange
        let dir = tree_with_marker_in_a(".root");
        let from = dir.path().join("a/b/c");
        let marker = "no-such-marker-checksync-test";

        // Act
        let result = closesdir(&from, marker);

        // Assert
        assert_eq!(
            result,
            Err(RootMarkerError::NotFound {
                marker: marker.to_owned(),
                from,
            })
        );
    }

    #[test]
    fn rejects_a_relative_starting_path() {
        // Arrange
        let from = Path::new("a/b");

        // Act
        let result = closesdir(from, ".root");

        // Assert
        assert_eq!(
            result,
            Err(RootMarkerError::RelativeStart {
                from: from.to_path_buf(),
            })
        );
    }
}
