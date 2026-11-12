use crate::gitignore_pattern_matches::gitignore_pattern_matches;
use crate::types::{GitignorePattern, IgnoreDecision};

/// Find what the last ignore-file pattern matching a path says about it.
///
/// # Arguments
///
/// * `patterns` - The ignore file's patterns, in order.
/// * `path` - The path relative to the ignore file's folder, with `/`
///   between names.
/// * `is_folder` - Whether the path is a folder rather than a file.
///
/// # Returns
///
/// `IgnoreDecision::Unignored` if the last matching pattern is negated,
/// `IgnoreDecision::Ignored` if it isn't, or `IgnoreDecision::NoOpinion` if
/// no pattern matches.
#[must_use]
pub(crate) fn gitignore_last_match(
    patterns: &[GitignorePattern],
    path: &[u8],
    is_folder: bool,
) -> IgnoreDecision {
    match patterns
        .iter()
        .rev()
        .find(|pattern| gitignore_pattern_matches(pattern, path, is_folder))
    {
        Some(pattern) if pattern.negated => IgnoreDecision::Unignored,
        Some(_) => IgnoreDecision::Ignored,
        None => IgnoreDecision::NoOpinion,
    }
}

#[cfg(test)]
mod tests {
    use super::gitignore_last_match;
    use crate::gitignore_parse::gitignore_parse;
    use crate::types::IgnoreDecision;

    #[test]
    fn ignores_a_path_matching_a_plain_pattern() {
        // Arrange
        let patterns = gitignore_parse(b"*.log\n");

        // Act
        let result = gitignore_last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn unignores_a_path_matching_a_negated_pattern() {
        // Arrange
        let patterns = gitignore_parse(b"!a.log\n");

        // Act
        let result = gitignore_last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn lets_the_last_matching_pattern_decide() {
        // Arrange
        let patterns = gitignore_parse(b"*.log\n!a.log\nb.log\n");

        // Act
        let result = gitignore_last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn has_no_opinion_when_nothing_matches() {
        // Arrange
        let patterns = gitignore_parse(b"*.log\n");

        // Act
        let result = gitignore_last_match(&patterns, b"a.js", false);

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }
}
