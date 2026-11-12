use std::fmt;
use std::io;
use std::path::PathBuf;

use crate::glob::CompiledGlob;

/// An include pattern and the folder to start walking from to find its files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GlobTask {
    /// The folder to walk, relative to the working folder, with `/` between
    /// names; `.` for the working folder itself.
    pub base: String,
    /// The pattern, relative to the working folder, that files must match.
    pub pattern: String,
}

/// The include tasks and exclude patterns for one search.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GlobPlan {
    /// The include patterns, each with the folder to walk.
    pub tasks: Vec<GlobTask>,
    /// The patterns that remove files and prune folders, relative to the
    /// working folder.
    pub excludes: Vec<String>,
}

/// Patterns that a path matches either as globs or as its literal text.
///
/// As in fast-glob, a pattern also matches a path whose text is exactly the
/// pattern, so `app/[slug]/page.tsx` finds that file even though `[slug]` is
/// a bracket set.
#[derive(Debug, Clone, Default)]
pub(super) struct PatternSet {
    /// The patterns compiled as globs; those that can never match are left
    /// out.
    pub globs: Vec<CompiledGlob>,
    /// The patterns as literal text.
    pub literals: Vec<Vec<u8>>,
}

/// The compiled exclude patterns, for checking files and for checking folders.
#[derive(Debug, Clone, Default)]
pub(super) struct ExcludeGlobs {
    /// The patterns as given, which remove a file whose path they match.
    pub files: PatternSet,
    /// The patterns, plus the folder before each trailing `/**`, which prune
    /// a folder whose path they match, with everything in it.
    pub folders: PatternSet,
}

/// Why `get_files` couldn't find files.
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

#[cfg(test)]
mod tests {
    use std::error::Error;
    use std::io;
    use std::path::PathBuf;

    use super::GetFilesError;

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
}
