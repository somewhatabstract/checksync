use std::path::{Path, PathBuf};

use crate::types::RootMarkerError;

/// The root marker checksync looks for when none is configured.
pub const DEFAULT_ROOT_MARKER: &str = "package.json";

/// Find the closest folder at or above a path that contains a root marker.
///
/// The search checks `from` itself, then each folder above it, up to the
/// file system root. The marker can be a file or a folder. This matches
/// `closesdir` from the `ancesdir` package, which checksync's JavaScript
/// implementation uses.
///
/// # Arguments
///
/// * `from` - The absolute path to start from: a folder, or a file whose
///   folders are searched.
/// * `marker` - The name of the file or folder that marks the root.
///
/// # Returns
///
/// The first folder that contains `marker`.
///
/// # Errors
///
/// [`RootMarkerError::RelativeStart`] if `from` isn't absolute, and
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
    use std::path::Path;

    use tempfile::TempDir;

    use super::closesdir;
    use crate::types::RootMarkerError;

    /// Make a temporary folder tree of `a/b/c` with `marker` in `a`.
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
