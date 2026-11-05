use std::path::{Path, PathBuf};

use crate::closesdir::{DEFAULT_ROOT_MARKER, closesdir};
use crate::node_relative::node_relative;
use crate::types::RootMarkerError;

/// Make an absolute file path relative to the root folder it's under.
///
/// The root is the closest folder at or above the file with the root marker
/// (see [`closesdir`]). The result is worked out as Node.js's `path.relative`
/// would, so `.`, `..` and repeated separators in the file path are resolved
/// as text. A path that's already relative is returned as it is.
///
/// # Arguments
///
/// * `file_path` - The file's path.
/// * `marker` - The root marker, or `None` for [`DEFAULT_ROOT_MARKER`].
///
/// # Returns
///
/// The path relative to the root, using the platform's separators.
///
/// # Errors
///
/// [`RootMarkerError::NotFound`] if no folder above the file has the marker.
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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::root_relative_path;
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
}
