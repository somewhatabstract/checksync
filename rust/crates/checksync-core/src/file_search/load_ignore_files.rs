use std::path::Path;

use crate::gitignore::IgnoreFile;

use super::find_files::find_files;
use super::load_found_ignore_files::load_found_ignore_files;
use super::plan_glob_tasks::plan_glob_tasks;
use super::types::GetFilesError;

/// Find and load the ignore files that some paths or globs name.
///
/// The globs are matched as include patterns are, and the files are loaded
/// in path order, so an ignore file in a folder comes after those above it
/// and its patterns win. A path that names no file loads nothing.
///
/// # Arguments
///
/// * `ignore_file_globs` - Paths or globs naming the ignore files, relative
///   to `cwd`.
/// * `cwd` - The absolute working folder.
///
/// # Returns
///
/// The loaded ignore files, from the top folder down.
///
/// # Errors
///
/// A glob whose braces can't be expanded, or any error finding or reading
/// the ignore files.
pub(super) fn load_ignore_files(
    ignore_file_globs: &[String],
    cwd: &Path,
) -> Result<Vec<IgnoreFile>, GetFilesError> {
    let plan = plan_glob_tasks(ignore_file_globs, &[])?;
    load_found_ignore_files(&find_files(&plan, cwd)?)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::TempDir;

    use super::load_ignore_files;
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
}
