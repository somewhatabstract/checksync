use crate::gitignore::last_match::last_match;
use crate::gitignore::types::GitignorePattern;
use crate::types::IgnoreDecision;

/// Decide what an ignore file's patterns say about a file inside its folder.
///
/// Each folder above the file is checked first, from the top down; if any
/// of them is ignored, so is the file, whatever the patterns say about the
/// file itself. Otherwise the last pattern matching the file decides.
///
/// # Arguments
///
/// * `patterns` - The ignore file's patterns, in order.
/// * `path` - The file's path relative to the ignore file's folder, with
///   `/` between names.
///
/// # Returns
///
/// Whether the file is ignored, unignored, or neither.
#[must_use]
pub(super) fn decide_path(patterns: &[GitignorePattern], path: &[u8]) -> IgnoreDecision {
    let folder_ignored = path
        .iter()
        .enumerate()
        .filter(|&(_, &byte)| byte == b'/')
        .any(|(end, _)| last_match(patterns, &path[..end], true) == IgnoreDecision::Ignored);
    if folder_ignored {
        return IgnoreDecision::Ignored;
    }
    last_match(patterns, path, false)
}

#[cfg(test)]
mod tests {
    use super::decide_path;
    use crate::gitignore::parse::parse;
    use crate::types::IgnoreDecision;

    #[test]
    fn ignores_a_file_in_an_ignored_folder_even_when_negated() {
        // Arrange
        let patterns = parse(b"logs/\n!logs/keep.log\n");

        // Act
        let result = decide_path(&patterns, b"logs/keep.log");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_file_in_an_ignored_folder_deeper_down() {
        // Arrange
        let patterns = parse(b"a/b/\n");

        // Act
        let result = decide_path(&patterns, b"a/b/c/d.js");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn decides_by_the_file_when_its_folder_is_unignored() {
        // Arrange
        let patterns = parse(b"a/*\n!a/b\n");

        // Act
        let result = decide_path(&patterns, b"a/b/x");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn decides_by_the_last_pattern_matching_the_file() {
        // Arrange
        let patterns = parse(b"logs/*\n!logs/keep.log\n");

        // Act
        let result = decide_path(&patterns, b"logs/keep.log");

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn ignores_a_name_at_the_top_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"b");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_name_deeper_down_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"x/y/b");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_folders_contents_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"b/c");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn needs_a_whole_name_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"ab");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn matches_within_the_first_name_with_an_anchored_joined_double_star() {
        // Arrange
        let patterns = parse(b"/a**/b\n");

        // Act
        let result = decide_path(&patterns, b"ax/b");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn does_not_cross_folders_with_an_anchored_joined_double_star() {
        // Arrange
        let patterns = parse(b"/a**/b\n");

        // Act
        let result = decide_path(&patterns, b"ax/y/b");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn anchors_a_joined_double_star_to_the_folder() {
        // Arrange
        let patterns = parse(b"/a**/b\n");

        // Act
        let result = decide_path(&patterns, b"x/a/b");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn anchors_a_pattern_whose_only_slash_is_leading() {
        // Arrange
        let patterns = parse(b"/**b\n");

        // Act
        let result = decide_path(&patterns, b"x/xb");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn matches_a_name_at_any_depth_without_a_leading_slash() {
        // Arrange
        let patterns = parse(b"**b\n");

        // Act
        let result = decide_path(&patterns, b"x/xb");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }
}
