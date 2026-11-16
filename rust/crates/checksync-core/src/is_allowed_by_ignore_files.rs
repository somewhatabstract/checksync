use std::path::Path;

use crate::gitignore::IgnoreFile;
use crate::types::IgnoreDecision;

/// Decide whether a set of ignore files lets checksync process a file.
///
/// Each ignore file with an opinion replaces the previous one's, so with the
/// files ordered from the top folder down, an ignore file closer to the file
/// overrides one further up. A file no ignore file has an opinion on is
/// allowed.
///
/// # Arguments
///
/// * `ignore_files` - The ignore files, from the top folder down.
/// * `file_path` - The absolute path of the file.
///
/// # Returns
///
/// `false` if the last opinion is that the file is ignored, `true` otherwise.
#[must_use]
pub fn is_allowed_by_ignore_files(ignore_files: &[IgnoreFile], file_path: &Path) -> bool {
    // The last ignore file with an opinion wins, so look from the end.
    ignore_files
        .iter()
        .rev()
        .map(|ignore_file| ignore_file.decide(file_path))
        .find(|decision| *decision != IgnoreDecision::NoOpinion)
        != Some(IgnoreDecision::Ignored)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::TempDir;

    use super::is_allowed_by_ignore_files;
    use crate::gitignore::IgnoreFile;

    /// Write `contents` to `.gitignore` in `folder` and load it.
    fn ignore_file(folder: &Path, contents: &str) -> IgnoreFile {
        fs::create_dir_all(folder).unwrap();
        let path = folder.join(".gitignore");
        fs::write(&path, contents).unwrap();
        IgnoreFile::load(&path).unwrap()
    }

    #[test]
    fn allows_a_file_with_no_ignore_files() {
        // Arrange
        let dir = TempDir::new().unwrap();

        // Act
        let result = is_allowed_by_ignore_files(&[], &dir.path().join("a.js"));

        // Assert
        assert!(result);
    }

    #[test]
    fn rejects_an_ignored_file() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let files = [ignore_file(dir.path(), "*.js\n")];

        // Act
        let result = is_allowed_by_ignore_files(&files, &dir.path().join("a.js"));

        // Assert
        assert!(!result);
    }

    #[test]
    fn lets_a_closer_ignore_file_unignore_a_file() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let files = [
            ignore_file(dir.path(), "*.js\n"),
            ignore_file(&dir.path().join("sub"), "!a.js\n"),
        ];

        // Act
        let result = is_allowed_by_ignore_files(&files, &dir.path().join("sub/a.js"));

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_an_earlier_opinion_when_a_later_file_has_none() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let files = [
            ignore_file(dir.path(), "*.js\n"),
            ignore_file(&dir.path().join("sub"), "*.log\n"),
        ];

        // Act
        let result = is_allowed_by_ignore_files(&files, &dir.path().join("sub/a.js"));

        // Assert
        assert!(!result);
    }
}
