use std::path::{Component, Path};

use crate::node_relative::node_relative;

/// Find a file's path inside an ignore file's folder, as patterns see it.
///
/// Both paths are normalized first, so `..` segments are resolved. On Unix
/// the result is the path's raw bytes, so names that aren't valid UTF-8 are
/// kept as they are; elsewhere it's the path's text with `/` separators.
///
/// # Arguments
///
/// * `folder` - The absolute path of the ignore file's folder.
/// * `file_path` - The absolute path of the file.
///
/// # Returns
///
/// The file's path relative to the folder, with `/` between names, or
/// `None` if the file isn't inside the folder (including when it is the
/// folder itself).
#[must_use]
pub(super) fn relative_path(folder: &Path, file_path: &Path) -> Option<Vec<u8>> {
    let relative = node_relative(folder, folder, file_path);
    let outside = matches!(
        relative.components().next(),
        None | Some(Component::ParentDir | Component::RootDir | Component::Prefix(_))
    );
    (!outside).then(|| path_bytes(&relative))
}

/// Get a relative path's raw bytes, which already use `/` separators.
#[cfg(unix)]
fn path_bytes(path: &Path) -> Vec<u8> {
    use std::os::unix::ffi::OsStrExt;
    path.as_os_str().as_bytes().to_vec()
}

/// Get a relative path's text with `/` separators.
#[cfg(not(unix))]
fn path_bytes(path: &Path) -> Vec<u8> {
    crate::normalize_separators::normalize_separators(&path.to_string_lossy()).into_bytes()
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::relative_path;

    fn root() -> PathBuf {
        std::env::temp_dir().join("root")
    }

    #[test]
    fn finds_the_path_inside_the_folder_with_slashes() {
        // Arrange
        let file = root().join("a").join("b.js");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, Some(b"a/b.js".to_vec()));
    }

    #[test]
    fn resolves_parent_segments() {
        // Arrange
        let file = root().join("a").join("..").join("b.js");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, Some(b"b.js".to_vec()));
    }

    #[test]
    fn finds_nothing_for_a_file_outside_the_folder() {
        // Arrange
        let file = root().join("..").join("b.js");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_nothing_for_a_sibling_folder_sharing_its_name() {
        // Arrange
        let folder = root().join("a");
        let file = root().join("ab").join("x.log");

        // Act
        let result = relative_path(&folder, &file);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_nothing_for_the_folder_itself() {
        // Arrange
        let folder = root();

        // Act
        let result = relative_path(&folder, &folder);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn keeps_a_name_starting_with_two_dots() {
        // Arrange
        let file = root().join("..b");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, Some(b"..b".to_vec()));
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_raw_bytes_of_a_name_that_is_not_utf8() {
        // Arrange
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;
        let file = root().join(OsStr::from_bytes(b"caf\xE9"));

        // Act
        let result = relative_path(Path::new(&root()), &file);

        // Assert
        assert_eq!(result, Some(b"caf\xE9".to_vec()));
    }
}
