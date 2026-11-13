use crate::glob::{BraceExpansionError, expand_braces};

use super::types::GetFilesError;

/// Expand a pattern's brace groups into the patterns they stand for.
///
/// # Arguments
///
/// * `pattern` - The pattern.
///
/// # Returns
///
/// The expanded patterns, in order; just the pattern if it has no groups.
///
/// # Errors
///
/// A pattern too long to expand, or one that expands to too many patterns.
pub(super) fn expand_pattern_braces(pattern: &str) -> Result<Vec<String>, GetFilesError> {
    // Brace expansion only splits at ASCII bytes, so the results are as valid
    // as the pattern.
    expand_braces(pattern.as_bytes())
        .map(|expanded| {
            expanded
                .iter()
                .map(|bytes| String::from_utf8_lossy(bytes).into_owned())
                .collect()
        })
        .map_err(|error| match error {
            BraceExpansionError::PatternTooLong => GetFilesError::PatternTooLong {
                pattern: pattern.to_owned(),
            },
            BraceExpansionError::TooManyResults => GetFilesError::TooManyPatterns {
                pattern: pattern.to_owned(),
            },
        })
}

#[cfg(test)]
mod tests {
    use super::expand_pattern_braces;

    #[test]
    fn expands_brace_groups() {
        // Arrange
        let pattern = "src/*.{js,ts}";

        // Act
        let result = expand_pattern_braces(pattern).unwrap();

        // Assert
        assert_eq!(result, vec!["src/*.js", "src/*.ts"]);
    }

    #[test]
    fn keeps_a_pattern_without_groups() {
        // Arrange
        let pattern = "src/é.js";

        // Act
        let result = expand_pattern_braces(pattern).unwrap();

        // Assert
        assert_eq!(result, vec!["src/é.js"]);
    }

    #[test]
    fn fails_for_a_pattern_too_long_to_expand() {
        // Arrange
        let pattern = format!("{{a,b}}{}", "x".repeat(10_000));

        // Act
        let result = expand_pattern_braces(&pattern);

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            format!("pattern is too long to expand its braces: {pattern}")
        );
    }

    #[test]
    fn fails_for_a_pattern_that_expands_too_far() {
        // Arrange
        let pattern = "{a,b}".repeat(20);

        // Act
        let result = expand_pattern_braces(&pattern);

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            format!("pattern's braces expand to too many patterns: {pattern}")
        );
    }
}
