use std::fmt;
use std::io;

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

/// The compiled exclude patterns, for checking files and for checking folders.
#[derive(Debug, Clone, Default)]
pub(super) struct ExcludeGlobs {
    /// The patterns as given, which remove a file whose path they match.
    pub files: Vec<CompiledGlob>,
    /// The patterns, plus the folder before each trailing `/**`, which prune
    /// a folder whose path they match, with everything in it.
    pub folders: Vec<CompiledGlob>,
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
    Io(io::Error),
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
            Self::Io(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for GetFilesError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io(error) => Some(error),
            Self::PatternTooLong { .. } | Self::TooManyPatterns { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::error::Error;
    use std::io;

    use super::GetFilesError;

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
    fn describes_an_io_error_by_its_message() {
        // Arrange
        let error = GetFilesError::Io(io::Error::other("disk on fire"));

        // Act
        let result = error.to_string();

        // Assert
        assert_eq!(result, "disk on fire");
    }

    #[test]
    fn gives_the_io_error_as_its_source() {
        // Arrange
        let error = GetFilesError::Io(io::Error::other("disk on fire"));

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
