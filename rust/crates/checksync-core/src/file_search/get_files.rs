use std::path::{Path, PathBuf};

use crate::is_allowed_by_ignore_files::is_allowed_by_ignore_files;

use super::expand_folder_pattern::expand_folder_pattern;
use super::find_files::find_files;
use super::load_ignore_files::load_ignore_files;
use super::plan_glob_tasks::plan_glob_tasks;
use super::types::GetFilesError;

/// Find the files to check, as checksync's JavaScript implementation does.
///
/// Include patterns are globs relative to `cwd`, matched case-sensitively
/// against regular files; links found while walking are neither followed nor
/// listed. A folder named without a `*` stands for everything below it.
/// Wildcards don't match names starting with `.`, so hidden files and folders
/// are only found when a pattern names them. `{a,b}` groups are expanded, and
/// an include pattern starting with `!` excludes instead. Files that an
/// exclude pattern or an ignore file rules out are dropped.
///
/// An exclude pattern removes a file whose path it matches, and a folder
/// whose path it matches, with everything in it, wherever that folder is on
/// the way to the file. Exclude patterns match names starting with `.` too.
///
/// Deliberate differences from the JavaScript implementation, which uses
/// fast-glob:
///
/// - Excludes always prune the folders they match. fast-glob only prunes for
///   excludes without wildcards, and never a pattern's starting folder.
/// - `x/**` matches what's below `x`, not `x` itself.
/// - A pattern that walks into a file finds nothing rather than failing.
/// - Brace ranges like `{1..3}` aren't expanded, extglobs like `@(a|b)`
///   aren't supported, and patterns otherwise follow git's glob rules where
///   fast-glob's differ.
///
/// # Arguments
///
/// * `include_globs` - The patterns of files to check.
/// * `exclude_globs` - The patterns of files and folders to leave out.
/// * `ignore_file_globs` - Paths or globs naming `.gitignore`-style files.
/// * `cwd` - The absolute working folder the patterns are relative to.
///
/// # Returns
///
/// The absolute paths of the files, each listed once, sorted as JavaScript
/// sorts strings.
///
/// # Errors
///
/// A pattern whose braces can't be expanded, or any error reading a folder
/// or an ignore file.
pub fn get_files(
    include_globs: &[String],
    exclude_globs: &[String],
    ignore_file_globs: &[String],
    cwd: &Path,
) -> Result<Vec<PathBuf>, GetFilesError> {
    let includes: Vec<String> = include_globs
        .iter()
        .map(|pattern| expand_folder_pattern(pattern, cwd))
        .collect();
    let ignore_files = load_ignore_files(ignore_file_globs, cwd)?;
    let plan = plan_glob_tasks(&includes, exclude_globs)?;
    let mut files = find_files(&plan, cwd)?;
    files.retain(|file| is_allowed_by_ignore_files(&ignore_files, file));
    Ok(files)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::TempDir;

    use super::get_files;
    fn too_many_message(pattern: &str) -> String {
        format!("pattern's braces expand to too many patterns: {pattern}")
    }

    fn write(root: &Path, file: &str, contents: &str) {
        let path = root.join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|&value| value.to_owned()).collect()
    }

    #[test]
    fn finds_everything_below_a_named_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js", "");
        write(cwd.path(), "src/nested/b.js", "");

        // Act
        let result = get_files(&strings(&["src"]), &[], &[], cwd.path()).unwrap();

        // Assert
        assert_eq!(
            result,
            vec![
                cwd.path().join("src/a.js"),
                cwd.path().join("src/nested/b.js")
            ]
        );
    }

    #[test]
    fn leaves_out_excluded_files() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js", "");
        write(cwd.path(), "b.js", "");

        // Act
        let result = get_files(&strings(&["*.js"]), &strings(&["b.js"]), &[], cwd.path()).unwrap();

        // Assert
        assert_eq!(result, vec![cwd.path().join("a.js")]);
    }

    #[test]
    fn leaves_out_files_an_ignore_file_ignores() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), ".gitignore", "b.js\n");
        write(cwd.path(), "a.js", "");
        write(cwd.path(), "b.js", "");

        // Act
        let result = get_files(
            &strings(&["*.js"]),
            &[],
            &strings(&[".gitignore"]),
            cwd.path(),
        )
        .unwrap();

        // Assert
        assert_eq!(result, vec![cwd.path().join("a.js")]);
    }

    #[test]
    fn fails_for_an_include_whose_braces_expand_too_far() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = get_files(&["{a,b}".repeat(20)], &[], &[], cwd.path()).map(|_| ());

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            too_many_message(&"{a,b}".repeat(20))
        );
    }

    #[test]
    fn fails_for_an_ignore_file_glob_whose_braces_expand_too_far() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result =
            get_files(&strings(&["*.js"]), &[], &["{a,b}".repeat(20)], cwd.path()).map(|_| ());

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            too_many_message(&"{a,b}".repeat(20))
        );
    }

    #[test]
    fn fails_when_a_folder_cannot_be_read() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        let too_long = format!("{}/*.js", "a".repeat(300));

        // Act
        let result = get_files(&[too_long], &[], &[], cwd.path()).map(|_| ());

        // Assert
        assert!(result.unwrap_err().to_string().starts_with("cannot read "));
    }
}
