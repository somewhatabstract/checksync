use super::pattern_matches::pattern_matches;
use super::types::GitignorePattern;
use crate::types::IgnoreDecision;

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
pub(super) fn last_match(
    patterns: &[GitignorePattern],
    path: &[u8],
    is_folder: bool,
) -> IgnoreDecision {
    let name = path.rsplit(|&byte| byte == b'/').next().unwrap_or_default();
    match patterns
        .iter()
        .rev()
        .find(|pattern| pattern_matches(pattern, path, name, is_folder))
    {
        Some(pattern) if pattern.negated => IgnoreDecision::Unignored,
        Some(_) => IgnoreDecision::Ignored,
        None => IgnoreDecision::NoOpinion,
    }
}

#[cfg(test)]
mod tests {
    use super::super::parse::parse;
    use super::last_match;
    use crate::types::IgnoreDecision;

    #[test]
    fn ignores_a_path_matching_a_plain_pattern() {
        // Arrange
        let patterns = parse(b"*.log\n");

        // Act
        let result = last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn unignores_a_path_matching_a_negated_pattern() {
        // Arrange
        let patterns = parse(b"!a.log\n");

        // Act
        let result = last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn lets_the_last_matching_pattern_decide() {
        // Arrange
        let patterns = parse(b"*.log\n!a.log\nb.log\n");

        // Act
        let result = last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn matches_a_name_pattern_against_the_last_name() {
        // Arrange
        let patterns = parse(b"c.log\n");

        // Act
        let result = last_match(&patterns, b"a/b/c.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn has_no_opinion_when_nothing_matches() {
        // Arrange
        let patterns = parse(b"*.log\n");

        // Act
        let result = last_match(&patterns, b"a.js", false);

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }
}
