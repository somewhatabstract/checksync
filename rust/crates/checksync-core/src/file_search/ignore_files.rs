//! Loading ignore files and checking files against them.

use std::path::{Path, PathBuf};

use crate::gitignore::IgnoreFile;
use crate::types::IgnoreDecision;

use super::GetFilesError;
use super::find_files::find_files;
use super::plan::plan_glob_tasks;

/// Finds and loads the ignore files that some paths or globs name.
///
/// The paths and globs are relative to `cwd`, the absolute working folder.
/// The globs are matched as include patterns are, and the files are loaded
/// in path order, from the top folder down, so an ignore file in a folder
/// comes after those above it and its patterns win. A path that names no
/// file loads nothing.
///
/// # Errors
///
/// Returns [`GetFilesError::PatternTooLong`] or
/// [`GetFilesError::TooManyPatterns`] for a glob whose braces can't be
/// expanded, and [`GetFilesError::Io`] for any error finding or reading the
/// ignore files.
pub(super) fn load_ignore_files(
    ignore_file_globs: &[String],
    cwd: &Path,
) -> Result<Vec<IgnoreFile>, GetFilesError> {
    let plan = plan_glob_tasks(ignore_file_globs, &[])?;
    load_found_ignore_files(&find_files(&plan, cwd)?)
}

/// Loads ignore files that have been found, in the order given.
///
/// The files are given by their absolute paths.
///
/// # Errors
///
/// Returns [`GetFilesError::Io`], with its path, for the first ignore file
/// that can't be read.
fn load_found_ignore_files(files: &[PathBuf]) -> Result<Vec<IgnoreFile>, GetFilesError> {
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

/// Checks whether a set of ignore files lets checksync process a file.
///
/// Each ignore file with an opinion replaces the previous one's, so with the
/// files ordered from the top folder down, an ignore file closer to the file
/// overrides one further up. `file_path` is the file's absolute path.
///
/// Returns `false` if the last opinion is that the file is ignored, and
/// `true` otherwise, including when no ignore file has an opinion on it.
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

    use super::{is_allowed_by_ignore_files, load_found_ignore_files, load_ignore_files};
    use crate::gitignore::IgnoreFile;
    use crate::types::IgnoreDecision;

    fn write(root: &Path, file: &str, contents: &str) {
        let path = root.join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|&value| value.to_owned()).collect()
    }

    #[test]
    fn loads_the_ignore_files_a_glob_names_from_the_top_down() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), ".gitignore", "*.log\n");
        write(cwd.path(), "src/.gitignore", "!keep.log\n");

        // Act
        let result = load_ignore_files(&strings(&["**/.gitignore"]), cwd.path()).unwrap();

        // Assert
        let decisions: Vec<_> = result
            .iter()
            .map(|file| file.decide(&cwd.path().join("src/keep.log")))
            .collect();
        assert_eq!(
            decisions,
            vec![IgnoreDecision::Ignored, IgnoreDecision::Unignored]
        );
    }

    #[test]
    fn loads_nothing_for_a_path_that_names_no_file() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = load_ignore_files(&strings(&[".gitignore"]), cwd.path()).unwrap();

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn fails_for_a_glob_whose_braces_expand_too_far() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = load_ignore_files(&["{a,b}".repeat(20)], cwd.path()).map(|_| ());

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            format!(
                "pattern's braces expand to too many patterns: {}",
                "{a,b}".repeat(20)
            )
        );
    }

    #[test]
    fn fails_when_a_folder_cannot_be_read() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        let too_long = format!("{}/.gitignore", "a".repeat(300));

        // Act
        let result = load_ignore_files(&[too_long], cwd.path()).map(|_| ());

        // Assert
        assert!(result.unwrap_err().to_string().starts_with("cannot read "));
    }

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

    /// Writes `contents` to `.gitignore` in `folder` and loads it.
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
