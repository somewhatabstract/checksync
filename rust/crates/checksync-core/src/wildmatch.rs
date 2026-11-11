use crate::match_wild_from::match_wild_from;
use crate::types::{WildmatchInput, WildmatchOutcome};

/// Match a glob pattern against text, as git's `wildmatch` does.
///
/// `*` matches any run of characters, `?` any one, `[...]` a class of them
/// and `\` escapes the next character. With `pathname` set, `/` separates
/// folders: only `**` that makes up a whole folder name (such as `a/**/b`)
/// can match across one, and `*`, `?` and classes never match `/`. Without
/// it, `*` and `**` are the same. A NUL byte ends the pattern or text, as
/// in git.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `text` - The text to match.
/// * `pathname` - Whether `/` separates folders.
/// * `casefold` - Whether to ignore case, for ASCII letters only.
///
/// # Returns
///
/// Whether the whole text matches the pattern.
#[must_use]
pub(crate) fn wildmatch(pattern: &[u8], text: &[u8], pathname: bool, casefold: bool) -> bool {
    let input = WildmatchInput {
        pattern,
        text,
        pathname,
        casefold,
    };
    match_wild_from(input, 0, 0) == WildmatchOutcome::Match
}

#[cfg(test)]
mod tests {
    use super::wildmatch;

    /// Match with `/` separating folders and case mattering.
    fn path_match(pattern: &str, text: &str) -> bool {
        wildmatch(pattern.as_bytes(), text.as_bytes(), true, false)
    }

    #[test]
    fn matches_literal_text() {
        // Arrange
        let pattern = "a.txt";

        // Act
        let result = [path_match(pattern, "a.txt"), path_match(pattern, "b.txt")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn needs_the_whole_text_to_match() {
        // Arrange
        let pattern = "a";

        // Act
        let result = [path_match(pattern, "ab"), path_match("ab", "a")];

        // Assert
        assert_eq!(result, [false, false]);
    }

    #[test]
    fn matches_any_one_character_except_a_slash_with_a_question_mark() {
        // Arrange
        let pattern = "a?c";

        // Act
        let result = [path_match(pattern, "abc"), path_match(pattern, "a/c")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_a_slash_with_a_question_mark_without_folders() {
        // Arrange
        let pattern = b"a?c";

        // Act
        let result = wildmatch(pattern, b"a/c", false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_within_one_folder_name_with_an_asterisk() {
        // Arrange
        let pattern = "a*c";

        // Act
        let result = [path_match(pattern, "abbc"), path_match(pattern, "ab/c")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_across_folders_with_an_asterisk_without_folders() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = wildmatch(pattern, b"ab/c", false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_number_of_folders_with_a_whole_double_asterisk() {
        // Arrange
        let pattern = "a/**/b";

        // Act
        let result = [
            path_match(pattern, "a/b"),
            path_match(pattern, "a/x/b"),
            path_match(pattern, "a/x/y/b"),
        ];

        // Assert
        assert_eq!(result, [true, true, true]);
    }

    #[test]
    fn matches_everything_with_a_trailing_double_asterisk() {
        // Arrange
        let pattern = "a/**";

        // Act
        let result = [path_match(pattern, "a/x"), path_match(pattern, "a/x/y")];

        // Assert
        assert_eq!(result, [true, true]);
    }

    #[test]
    fn matches_up_to_a_slash_with_a_trailing_asterisk() {
        // Arrange
        let pattern = "a/*";

        // Act
        let result = [path_match(pattern, "a/x"), path_match(pattern, "a/x/y")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_one_folder_name_with_an_asterisk_before_a_slash() {
        // Arrange
        let pattern = "*/b";

        // Act
        let result = [path_match(pattern, "a/b"), path_match(pattern, "a")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn treats_a_double_asterisk_inside_a_folder_name_as_one() {
        // Arrange
        let pattern = "a**b";

        // Act
        let result = [path_match(pattern, "axxb"), path_match(pattern, "ax/b")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn treats_a_double_asterisk_starting_a_folder_name_as_one() {
        // Arrange
        let pattern = "**a";

        // Act
        let result = [path_match(pattern, "xa"), path_match(pattern, "x/a")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_across_folders_with_a_double_asterisk_without_folders() {
        // Arrange
        let pattern = b"a**b";

        // Act
        let result = wildmatch(pattern, b"ax/b", false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn ends_a_whole_double_asterisk_at_an_escaped_slash() {
        // Arrange
        let pattern = r"a/**\/b";

        // Act
        let result = path_match(pattern, "a/x/b");

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_character_literally() {
        // Arrange
        let pattern = r"a\*";

        // Act
        let result = [path_match(pattern, "a*"), path_match(pattern, "ab")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_nothing_with_a_backslash_at_the_end() {
        // Arrange
        let pattern = "a\\";

        // Act
        let result = path_match(pattern, "a\\");

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_ascii_case_when_asked() {
        // Arrange
        let pattern = b"A*.TXT";

        // Act
        let result = wildmatch(pattern, b"abc.txt", true, true);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_the_case_of_an_escaped_letter() {
        // Arrange
        let pattern = br"\A";

        // Act
        let result = wildmatch(pattern, b"a", true, true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_bracket_class() {
        // Arrange
        let pattern = "[ab]c";

        // Act
        let result = [
            path_match(pattern, "bc"),
            path_match(pattern, "cc"),
            path_match("[ab", "a"),
        ];

        // Assert
        assert_eq!(result, [true, false, false]);
    }

    #[test]
    fn tries_later_starting_points_for_an_asterisk() {
        // Arrange
        let pattern = "*a?c";

        // Act
        let result = [path_match(pattern, "aaxc"), path_match(pattern, "xaxd")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn stops_an_asterisk_at_a_slash_before_the_next_literal() {
        // Arrange
        let pattern = "a*c";

        // Act
        let result = path_match(pattern, "ab/xc");

        // Assert
        assert!(!result);
    }

    #[test]
    fn backs_out_to_a_double_asterisk_when_an_asterisk_reaches_a_slash() {
        // Arrange
        let pattern = "**/a*?";

        // Act
        let result = [
            path_match(pattern, "x/ab/y/ab"),
            path_match(pattern, "x/a/b"),
        ];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_nothing_after_the_end_of_text_with_an_asterisk() {
        // Arrange
        let pattern = "a*?";

        // Act
        let result = path_match(pattern, "a");

        // Assert
        assert!(!result);
    }

    #[test]
    fn ends_the_pattern_at_a_nul_byte() {
        // Arrange
        let pattern = b"a\0b";

        // Act
        let result = wildmatch(pattern, b"a", true, false);

        // Assert
        assert!(result);
    }
}
