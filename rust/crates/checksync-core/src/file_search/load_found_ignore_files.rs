use std::path::PathBuf;

use crate::gitignore::IgnoreFile;

use super::types::GetFilesError;

/// Load ignore files that have been found, in the order given.
///
/// # Arguments
///
/// * `files` - The absolute paths of the ignore files.
///
/// # Returns
///
/// The loaded ignore files.
///
/// # Errors
///
/// The first ignore file that can't be read, with its path.
pub(super) fn load_found_ignore_files(files: &[PathBuf]) -> Result<Vec<IgnoreFile>, GetFilesError> {
    files
        .iter()
        .map(|file| {
            IgnoreFile::load(file).map_err(|error| GetFilesError::Io {
                path: file.clone(),
                error,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::load_found_ignore_files;

    #[test]
    fn loads_each_ignore_file() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = dir.path().join(".gitignore");
        fs::write(&file, "*.log\n").unwrap();

        // Act
        let result = load_found_ignore_files(&[file.clone(), file]).unwrap();

        // Assert
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn fails_with_the_path_of_an_ignore_file_that_cannot_be_read() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let missing = dir.path().join("missing");

        // Act
        let result = load_found_ignore_files(std::slice::from_ref(&missing)).map(|_| ());

        // Assert
        assert!(
            result
                .unwrap_err()
                .to_string()
                .starts_with(&format!("cannot read {}: ", missing.display()))
        );
    }
}
