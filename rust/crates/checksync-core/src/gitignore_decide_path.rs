use crate::gitignore_last_match::gitignore_last_match;
use crate::types::{GitignorePattern, IgnoreDecision};

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
pub(crate) fn gitignore_decide_path(patterns: &[GitignorePattern], path: &[u8]) -> IgnoreDecision {
    let folder_ignored = path
        .iter()
        .enumerate()
        .filter(|&(_, &byte)| byte == b'/')
        .any(|(end, _)| {
            gitignore_last_match(patterns, &path[..end], true) == IgnoreDecision::Ignored
        });
    if folder_ignored {
        return IgnoreDecision::Ignored;
    }
    gitignore_last_match(patterns, path, false)
}

#[cfg(test)]
mod tests {
    use super::gitignore_decide_path;
    use crate::gitignore_parse::gitignore_parse;
    use crate::types::IgnoreDecision;

    #[test]
    fn ignores_a_file_in_an_ignored_folder_even_when_negated() {
        // Arrange
        let patterns = gitignore_parse(b"logs/\n!logs/keep.log\n");

        // Act
        let result = gitignore_decide_path(&patterns, b"logs/keep.log");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_file_in_an_ignored_folder_deeper_down() {
        // Arrange
        let patterns = gitignore_parse(b"a/b/\n");

        // Act
        let result = gitignore_decide_path(&patterns, b"a/b/c/d.js");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn decides_by_the_file_when_its_folder_is_unignored() {
        // Arrange
        let patterns = gitignore_parse(b"a/*\n!a/b\n");

        // Act
        let result = gitignore_decide_path(&patterns, b"a/b/x");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn decides_by_the_last_pattern_matching_the_file() {
        // Arrange
        let patterns = gitignore_parse(b"logs/*\n!logs/keep.log\n");

        // Act
        let result = gitignore_decide_path(&patterns, b"logs/keep.log");

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }
}
