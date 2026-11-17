//! Compiled glob patterns: the options they're compiled with, compiling them,
//! and matching texts against them.

use super::hidden_names::HiddenNames;
use super::token::{GlobToken, tokenize_glob};
use super::units::bytes_before_nul;

/// How a glob pattern treats slashes, letter case and hidden names.
///
/// There's no default: callers choose every option.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct GlobOptions {
    /// Whether `/` separates folders.
    ///
    /// When set, `?`, `*` and bracket sets never match `/`, and a `**` that makes up a
    /// whole folder name matches any number of folders.
    pub pathname: bool,
    /// Whether ASCII letters match regardless of case.
    ///
    /// After a `\` or inside a bracket set, the text's byte is lowercased and
    /// compared with the pattern as written, so `\A` and `[A]` match nothing, though
    /// ranges and classes such as `[A-Z]` and `[:upper:]` still match lowercase
    /// letters.
    pub casefold: bool,
    /// Which hidden names wildcards may match, in pathname mode.
    ///
    /// Without [`pathname`](Self::pathname), this has no effect: wildcards match
    /// everything.
    pub hidden: HiddenNames,
    /// Whether `?` and bracket sets match whole UTF-8 characters.
    ///
    /// When on, as in fast-glob, `?` and a bracket set match one character of 1 to 4
    /// bytes, bracket sets compare code points, and `*` never stops inside a
    /// character. A byte that isn't part of valid UTF-8, in the pattern or the text,
    /// counts as one character on its own. When off, as in git, everything matches
    /// single bytes.
    pub unicode: bool,
}

/// A glob pattern compiled once so it can be matched against many texts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CompiledGlob {
    /// The pattern's tokens, in order.
    pub(super) tokens: Vec<GlobToken>,
    /// How the pattern treats slashes, letter case, hidden names and characters.
    pub(super) options: GlobOptions,
    /// Which hidden names wildcards may match.
    ///
    /// Worked out once from [`options`](Self::options): its
    /// [`hidden`](GlobOptions::hidden) choice in pathname mode, and
    /// [`HiddenNames::MatchAll`] otherwise.
    pub(super) hidden: HiddenNames,
}

impl CompiledGlob {
    /// Compiles a glob pattern so it can be matched against many texts.
    ///
    /// `options` says how to treat slashes, letter case, hidden names and characters.
    /// A NUL byte ends the pattern, as it would a C string. Returns `None` if the
    /// pattern can never match anything: it ends with a `\`, or has a malformed
    /// bracket set.
    #[must_use]
    pub(crate) fn try_new(pattern: &[u8], options: GlobOptions) -> Option<Self> {
        let tokens = tokenize_glob(bytes_before_nul(pattern), options)?;
        Some(Self {
            tokens,
            options,
            hidden: if options.pathname {
                options.hidden
            } else {
                HiddenNames::MatchAll
            },
        })
    }

    /// Checks whether the whole of a text matches this compiled glob.
    ///
    /// Matching works on bytes, the way git matches its globs, or with `unicode` on
    /// whole characters. `?` matches any one unit, `*` any run of them, `[...]` one
    /// unit from a set, and `\` makes the next unit literal. A NUL byte ends the
    /// text, as it would a C string. [`GlobOptions`] describes how `pathname`,
    /// `casefold`, `hidden` and `unicode` change this.
    ///
    /// Rather than backtracking, matching tracks every position in the text that the
    /// pattern so far can reach, so it takes time proportional to the pattern's
    /// length times the text's, however many stars there are. It stops as soon as no
    /// position is reachable.
    ///
    /// [`GlobOptions`]: GlobOptions
    #[must_use]
    pub(crate) fn matches(&self, text: &[u8]) -> bool {
        let text = bytes_before_nul(text);
        let mut positions = vec![false; text.len() + 1];
        positions[0] = true;
        self.tokens
            .iter()
            .all(|token| token.advance(text, &mut positions, self.options, self.hidden))
            && positions[text.len()]
    }
}

#[cfg(test)]
mod tests {
    use super::super::hidden_names::HiddenNames;
    use super::super::test_support::matches;
    use super::super::token::GlobToken;
    use super::super::unit_matcher::UnitMatcher;
    use super::super::{TEST_OPTIONS, TEST_PATHNAME_OPTIONS};
    use super::{CompiledGlob, GlobOptions};

    /// Compiles `?` with the given options and returns the hidden names kept.
    fn hidden(pathname: bool, hidden: HiddenNames) -> Option<HiddenNames> {
        let options = GlobOptions {
            pathname,
            casefold: false,
            hidden,
            unicode: false,
        };
        CompiledGlob::try_new(b"?", options).map(|glob| glob.hidden)
    }

    #[test]
    fn compiles_the_pattern_with_its_options() {
        // Arrange
        let pattern = b"?";

        // Act
        let result = CompiledGlob::try_new(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(CompiledGlob {
                tokens: vec![GlobToken::One(UnitMatcher::Any)],
                options: TEST_OPTIONS,
                hidden: HiddenNames::MatchAll,
            })
        );
    }

    #[test]
    fn ends_the_pattern_at_a_nul_byte() {
        // Arrange
        let pattern = b"?\0[";

        // Act
        let result = CompiledGlob::try_new(pattern, TEST_OPTIONS).map(|glob| glob.tokens);

        // Assert
        assert_eq!(result, Some(vec![GlobToken::One(UnitMatcher::Any)]));
    }

    #[test]
    fn rejects_a_pattern_that_can_never_match() {
        // Arrange
        let pattern = b"[ab";

        // Act
        let result = CompiledGlob::try_new(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn keeps_the_hidden_names_option_in_pathname_mode() {
        // Arrange
        let option = HiddenNames::SkipDotSegments;

        // Act
        let result = hidden(true, option);

        // Assert
        assert_eq!(result, Some(HiddenNames::SkipDotSegments));
    }

    #[test]
    fn matches_all_hidden_names_without_pathname_mode() {
        // Arrange
        let option = HiddenNames::SkipDotNames;

        // Act
        let result = hidden(false, option);

        // Assert
        assert_eq!(result, Some(HiddenNames::MatchAll));
    }

    const HIDING_DOTS: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
        hidden: HiddenNames::SkipDotNames,
        unicode: false,
    };

    const CASEFOLD: GlobOptions = GlobOptions {
        pathname: false,
        casefold: true,
        hidden: HiddenNames::MatchAll,
        unicode: false,
    };

    #[test]
    fn matches_identical_text() {
        // Arrange
        let pattern = b"abc";

        // Act
        let result = matches(pattern, b"abc", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn requires_the_whole_text_to_match() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = matches(pattern, b"abc", TEST_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_empty_text_with_an_empty_pattern() {
        // Arrange
        let pattern = b"";

        // Act
        let result = matches(pattern, b"", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_one_byte_with_a_question_mark() {
        // Arrange
        let pattern = b"a?c";

        // Act
        let result = matches(pattern, b"a/c", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_run_with_a_star() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = matches(pattern, b"ab/bc", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_empty_run_with_a_star() {
        // Arrange
        let pattern = b"a*";

        // Act
        let result = matches(pattern, b"a", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_byte_from_a_bracket_set() {
        // Arrange
        let pattern = b"[[:digit:]x-z]";

        // Act
        let result = matches(pattern, b"y", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_star_literally() {
        // Arrange
        let pattern = b"a\\*";

        // Act
        let result = matches(pattern, b"ab", TEST_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ends_the_text_at_a_nul_byte() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = matches(pattern, b"ab\0c", TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_star_in_pathname_mode() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = matches(pattern, b"ab/c", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_no_folders_with_a_leading_double_star() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = matches(pattern, b"x", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_several_folders_with_a_leading_double_star() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = matches(pattern, b"a/b/x", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_no_folders_with_a_middle_double_star() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/b", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_several_folders_with_a_middle_double_star() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/x/y/b", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_everything_inside_a_folder_with_a_trailing_double_star() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = matches(pattern, b"a/b/c", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_the_folder_itself_with_a_trailing_double_star() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = matches(pattern, b"a", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn treats_a_double_star_inside_a_name_as_a_single_star() {
        // Arrange
        let pattern = b"a**";

        // Act
        let result = matches(pattern, b"a/b", TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn needs_a_folder_for_a_middle_double_star_without_pathname_mode() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/b", TEST_OPTIONS);

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
        let result = matches(pattern, b"ABC", TEST_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_a_hidden_name_with_a_star_when_hiding_dots() {
        // Arrange
        let pattern = b"a/*";

        // Act
        let result = matches(pattern, b"a/.b", HIDING_DOTS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_hidden_name_with_a_literal_dot_when_hiding_dots() {
        // Arrange
        let pattern = b"a/.*";

        // Act
        let result = matches(pattern, b"a/.b", HIDING_DOTS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_enter_a_hidden_folder_with_a_double_star_when_hiding_dots() {
        // Arrange
        let pattern = b"**/c";

        // Act
        let result = matches(pattern, b"a/.b/c", HIDING_DOTS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_inside_a_named_hidden_folder_when_hiding_dots() {
        // Arrange
        let pattern = b".b/**";

        // Act
        let result = matches(pattern, b".b/c", HIDING_DOTS);

        // Assert
        assert!(result);
    }
}
