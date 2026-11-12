use crate::advance_glob_positions::advance_glob_positions;
use crate::bytes_before_nul::bytes_before_nul;
use crate::types::CompiledGlob;

/// Check whether the whole of a text matches a compiled glob pattern.
///
/// Matching works on bytes, the way git matches its globs. `?` matches any
/// one byte, `*` any run of bytes, `[...]` one byte from a set, and `\`
/// makes the next byte literal. A NUL byte ends the text, as it would a C
/// string. `GlobOptions` describes how `pathname` and `casefold` change
/// this.
///
/// Rather than backtracking, matching tracks every position in the text
/// that the pattern so far can reach, so it takes time proportional to the
/// pattern's length times the text's, however many stars there are. It
/// stops as soon as no position is reachable.
///
/// # Arguments
///
/// * `glob` - The compiled pattern.
/// * `text` - The text to match against it.
///
/// # Returns
///
/// `true` if the pattern matches the whole text.
#[must_use]
pub(crate) fn compiled_glob_matches(glob: &CompiledGlob, text: &[u8]) -> bool {
    let text = bytes_before_nul(text);
    let mut positions = vec![false; text.len() + 1];
    positions[0] = true;
    glob.tokens
        .iter()
        .all(|token| advance_glob_positions(token, text, &mut positions, glob.options))
        && positions[text.len()]
}

#[cfg(test)]
mod tests {
    use super::compiled_glob_matches;
    use crate::compile_glob::compile_glob;
    use crate::types::GlobOptions;

    /// Compile `pattern` and match `text` against it.
    fn matches(pattern: &[u8], text: &[u8], options: GlobOptions) -> bool {
        compiled_glob_matches(&compile_glob(pattern, options).unwrap(), text)
    }

    const PLAIN: GlobOptions = GlobOptions {
        pathname: false,
        casefold: false,
    };

    const PATHNAME: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
    };

    const CASEFOLD: GlobOptions = GlobOptions {
        pathname: false,
        casefold: true,
    };

    #[test]
    fn matches_identical_text() {
        // Arrange
        let pattern = b"abc";

        // Act
        let result = matches(pattern, b"abc", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn requires_the_whole_text_to_match() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = matches(pattern, b"abc", PLAIN);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_empty_text_with_an_empty_pattern() {
        // Arrange
        let pattern = b"";

        // Act
        let result = matches(pattern, b"", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_one_byte_with_a_question_mark() {
        // Arrange
        let pattern = b"a?c";

        // Act
        let result = matches(pattern, b"a/c", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_run_with_a_star() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = matches(pattern, b"ab/bc", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_empty_run_with_a_star() {
        // Arrange
        let pattern = b"a*";

        // Act
        let result = matches(pattern, b"a", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_byte_from_a_bracket_set() {
        // Arrange
        let pattern = b"[[:digit:]x-z]";

        // Act
        let result = matches(pattern, b"y", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_star_literally() {
        // Arrange
        let pattern = b"a\\*";

        // Act
        let result = matches(pattern, b"ab", PLAIN);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ends_the_text_at_a_nul_byte() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = matches(pattern, b"ab\0c", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_star_in_pathname_mode() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = matches(pattern, b"ab/c", PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_no_folders_with_a_leading_double_star() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = matches(pattern, b"x", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_several_folders_with_a_leading_double_star() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = matches(pattern, b"a/b/x", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_no_folders_with_a_middle_double_star() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/b", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_several_folders_with_a_middle_double_star() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/x/y/b", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_everything_inside_a_folder_with_a_trailing_double_star() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = matches(pattern, b"a/b/c", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_the_folder_itself_with_a_trailing_double_star() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = matches(pattern, b"a", PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn treats_a_double_star_inside_a_name_as_a_single_star() {
        // Arrange
        let pattern = b"a**";

        // Act
        let result = matches(pattern, b"a/b", PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn needs_a_folder_for_a_middle_double_star_without_pathname_mode() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/b", PLAIN);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_letters_in_either_case_when_folding_case() {
        // Arrange
        let pattern = b"AbC";

        // Act
        let result = matches(pattern, b"aBc", CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_range_in_either_case_when_folding_case() {
        // Arrange
        let pattern = b"[A-Z]";

        // Act
        let result = matches(pattern, b"q", CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn compares_non_ascii_bytes_exactly_when_folding_case() {
        // Arrange
        let pattern = b"\xc9";

        // Act
        let result = matches(pattern, b"\xe9", CASEFOLD);

        // Assert
        assert!(!result);
    }

    #[test]
    fn keeps_letter_case_without_folding_case() {
        // Arrange
        let pattern = b"abc";

        // Act
        let result = matches(pattern, b"ABC", PLAIN);

        // Assert
        assert!(!result);
    }
}
