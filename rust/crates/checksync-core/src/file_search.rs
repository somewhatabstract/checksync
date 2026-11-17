//! Finding the files checksync checks, from include, exclude and ignore files.
//!
//! This follows checksync's JavaScript implementation, which finds files with
//! fast-glob: include patterns are planned into folders to walk, the folders
//! are walked without following links, and files are filtered by exclude
//! patterns and `.gitignore`-style files. Matching uses the crate's
//! [`glob`](crate::glob) module, and ignore files use its
//! [`gitignore`](crate::gitignore) module.

mod excludes;
mod glob_base;
mod glob_text;
mod ignore_files;
mod pattern_set;
mod plan;
mod tidy_pattern;
mod walk;
mod walk_limits;

use std::fmt;
use std::io;
use std::path::{Path, PathBuf};

use crate::glob::{GlobOptions, HiddenNames};

use ignore_files::load_ignore_files;
use plan::GlobPlan;

pub use ignore_files::is_allowed_by_ignore_files;

/// How include patterns match paths, as fast-glob does by default.
///
/// They match by folder, case-sensitively, by whole characters, and without
/// wildcards matching names that start with `.`, or running over `.` or `..`.
const INCLUDE_GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    hidden: HiddenNames::SkipDotNames,
    unicode: true,
};

/// How exclude patterns match paths, as fast-glob's do.
///
/// They match as include patterns do, except that wildcards match names that
/// start with `.` too. They still don't run over `.` or `..`.
const EXCLUDE_GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    hidden: HiddenNames::SkipDotSegments,
    unicode: true,
};

/// Why [`get_files`] couldn't find files.
#[derive(Debug)]
pub enum GetFilesError {
    /// A pattern is too long to expand its brace groups.
    PatternTooLong {
        /// The pattern.
        pattern: String,
    },
    /// A pattern's brace groups expand to too many patterns.
    TooManyPatterns {
        /// The pattern.
        pattern: String,
    },
    /// A folder or ignore file couldn't be read.
    Io {
        /// The folder or file.
        path: PathBuf,
        /// What went wrong.
        error: io::Error,
    },
}

impl fmt::Display for GetFilesError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PatternTooLong { pattern } => {
                write!(f, "pattern is too long to expand its braces: {pattern}")
            }
            Self::TooManyPatterns { pattern } => {
                write!(f, "pattern's braces expand to too many patterns: {pattern}")
            }
            Self::Io { path, error } => write!(f, "cannot read {}: {error}", path.display()),
        }
    }
}

impl std::error::Error for GetFilesError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io { error, .. } => Some(error),
            Self::PatternTooLong { .. } | Self::TooManyPatterns { .. } => None,
        }
    }
}

/// Finds the files to check, as checksync's JavaScript implementation does.
///
/// Include patterns are globs relative to `cwd`, the absolute working folder,
/// matched case-sensitively against regular files; links found while walking
/// are neither followed nor listed. A folder named without a `*` stands for
/// everything below it. Wildcards don't match names starting with `.`, so
/// hidden files and folders are only found when a pattern names them.
/// `{a,b}` groups are expanded, and an include pattern starting with `!`
/// excludes instead. Files that an exclude pattern or an ignore file rules
/// out are dropped. `ignore_file_globs` are paths or globs naming
/// `.gitignore`-style files.
///
/// An exclude pattern removes a file whose path it matches, and a folder
/// whose path it matches, with everything in it, wherever that folder is on
/// the way to the file. Exclude patterns match names starting with `.` too.
///
/// The result is the files' absolute paths, each listed once, sorted as
/// JavaScript sorts strings.
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
/// # Errors
///
/// Returns [`GetFilesError::PatternTooLong`] or
/// [`GetFilesError::TooManyPatterns`] for a pattern whose braces can't be
/// expanded, and [`GetFilesError::Io`] for any error reading a folder or an
/// ignore file.
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
    let plan = GlobPlan::try_new(&includes, exclude_globs)?;
    let mut files = plan.find_files(cwd)?;
    files.retain(|file| is_allowed_by_ignore_files(&ignore_files, file));
    Ok(files)
}

/// Turns an include pattern naming a folder into one for everything below it.
///
/// The pattern is relative to `cwd`, the working folder. A pattern without a
/// `*` that names a folder (not a link to one) becomes `folder/**`, so `src`
/// finds every file below `src`, as checksync's JavaScript implementation
/// does. A trailing `/` is dropped first. Anything else is returned as it is.
#[must_use]
fn expand_folder_pattern(pattern: &str, cwd: &Path) -> String {
    let names_folder = !pattern.contains('*')
        && std::fs::symlink_metadata(cwd.join(pattern)).is_ok_and(|metadata| metadata.is_dir());
    if names_folder {
        format!("{}/**", pattern.trim_end_matches('/'))
    } else {
        pattern.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use std::error::Error;
    use std::fs;
    use std::io;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::{GetFilesError, expand_folder_pattern, get_files};

    fn io_error() -> GetFilesError {
        GetFilesError::Io {
            path: PathBuf::from("src"),
            error: io::Error::other("disk on fire"),
        }
    }

    #[test]
    fn describes_a_pattern_that_is_too_long() {
        // Arrange
        let error = GetFilesError::PatternTooLong {
            pattern: "{a,b}".to_owned(),
        };

        // Act
        let result = error.to_string();

        // Assert
        assert_eq!(result, "pattern is too long to expand its braces: {a,b}");
    }

    #[test]
    fn describes_a_pattern_with_too_many_expansions() {
        // Arrange
        let error = GetFilesError::TooManyPatterns {
            pattern: "{a,b}".to_owned(),
        };

        // Act
        let result = error.to_string();

        // Assert
        assert_eq!(
            result,
            "pattern's braces expand to too many patterns: {a,b}"
        );
    }

    #[test]
    fn describes_an_io_error_with_its_path() {
        // Arrange
        let error = io_error();

        // Act
        let result = error.to_string();

        // Assert
        assert_eq!(result, "cannot read src: disk on fire");
    }

    #[test]
    fn gives_the_io_error_as_its_source() {
        // Arrange
        let error = io_error();

        // Act
        let result = error.source().map(ToString::to_string);

        // Assert
        assert_eq!(result.as_deref(), Some("disk on fire"));
    }

    #[test]
    fn has_no_source_for_a_pattern_error() {
        // Arrange
        let error = GetFilesError::TooManyPatterns {
            pattern: "{a,b}".to_owned(),
        };

        // Act
        let result = error.source();

        // Assert
        assert!(result.is_none());
    }

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

    #[test]
    fn expands_a_folder_to_everything_below_it() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("src")).unwrap();

        // Act
        let result = expand_folder_pattern("src", cwd.path());

        // Assert
        assert_eq!(result, "src/**");
    }

    #[test]
    fn drops_a_trailing_slash_before_expanding() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("src")).unwrap();

        // Act
        let result = expand_folder_pattern("src/", cwd.path());

        // Assert
        assert_eq!(result, "src/**");
    }

    #[test]
    fn expands_the_working_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = expand_folder_pattern(".", cwd.path());

        // Assert
        assert_eq!(result, "./**");
    }

    #[test]
    fn keeps_a_file() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::write(cwd.path().join("a.js"), "").unwrap();

        // Act
        let result = expand_folder_pattern("a.js", cwd.path());

        // Assert
        assert_eq!(result, "a.js");
    }

    #[test]
    fn keeps_a_path_that_does_not_exist() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = expand_folder_pattern("missing", cwd.path());

        // Assert
        assert_eq!(result, "missing");
    }

    // Windows doesn't allow `*` in a folder name, so only Unix can have a
    // folder that a pattern with a star names exactly.
    #[cfg(unix)]
    #[test]
    fn keeps_a_pattern_with_a_star() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("s*")).unwrap();

        // Act
        let result = expand_folder_pattern("s*", cwd.path());

        // Assert
        assert_eq!(result, "s*");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_a_link_to_a_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("src")).unwrap();
        std::os::unix::fs::symlink("src", cwd.path().join("link")).unwrap();

        // Act
        let result = expand_folder_pattern("link", cwd.path());

        // Assert
        assert_eq!(result, "link");
    }
}
