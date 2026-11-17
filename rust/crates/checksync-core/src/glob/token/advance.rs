//! Moving the reachable text positions past one glob token.

use super::super::compiled_glob::GlobOptions;
use super::super::hidden_names::HiddenNames;
use super::GlobToken;
use super::wildcards::{advance_any_folders, advance_star};

impl GlobToken {
    /// Moves the reachable text positions past this token, in place.
    ///
    /// `positions` holds, for each position in `text` from 0 to its length, whether
    /// matching can reach it, and is updated to the positions reachable after
    /// the token. `options` says how to treat slashes and letter case, and whether to
    /// read the text as characters rather than bytes; `hidden` says which hidden
    /// names wildcards may match.
    ///
    /// Returns whether any position is reachable afterwards.
    #[must_use]
    pub(in crate::glob) fn advance(
        &self,
        text: &[u8],
        positions: &mut [bool],
        options: GlobOptions,
        hidden: HiddenNames,
    ) -> bool {
        let hides_dots = hidden == HiddenNames::SkipDotNames;
        match self {
            Self::One(matcher) if options.unicode => {
                matcher.advance_char(text, positions, options, hides_dots)
            }
            Self::One(matcher) => matcher.advance_byte(text, positions, options, hides_dots),
            Self::Star { crosses_slash } => {
                advance_star(text, positions, *crosses_slash, hidden, options.unicode)
            }
            Self::AnyFolders => advance_any_folders(text, positions, hidden),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::hidden_names::HiddenNames;
    use super::super::super::unit_matcher::UnitMatcher;
    use super::super::super::{TEST_PATHNAME_OPTIONS, TEST_UNICODE_OPTIONS};
    use super::super::GlobToken;

    #[test]
    fn moves_one_byte_for_a_single_byte_token() {
        // Arrange
        let token = GlobToken::One(UnitMatcher::Any);
        let mut positions = [true, false, false];

        // Act
        let _ = token.advance(
            b"ab",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            HiddenNames::MatchAll,
        );

        // Assert
        assert_eq!(positions, [false, true, false]);
    }

    #[test]
    fn spreads_within_a_folder_for_a_star() {
        // Arrange
        let token = GlobToken::Star {
            crosses_slash: false,
        };
        let mut positions = [true, false, false];

        // Act
        let _ = token.advance(
            b"a/",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            HiddenNames::MatchAll,
        );

        // Assert
        assert_eq!(positions, [true, true, false]);
    }

    #[test]
    fn spreads_to_folder_starts_for_any_folders() {
        // Arrange
        let token = GlobToken::AnyFolders;
        let mut positions = [true, false, false];

        // Act
        let _ = token.advance(
            b"a/",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            HiddenNames::MatchAll,
        );

        // Assert
        assert_eq!(positions, [true, false, true]);
    }

    #[test]
    fn reports_whether_any_position_is_reachable() {
        // Arrange
        let token = GlobToken::One(UnitMatcher::Literal(b'x'));
        let mut positions = [true, false];

        // Act
        let result = token.advance(
            b"a",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            HiddenNames::MatchAll,
        );

        // Assert
        assert!(!result);
    }

    #[test]
    fn moves_one_character_for_a_single_unit_token_with_unicode() {
        // Arrange
        let token = GlobToken::One(UnitMatcher::Any);
        let mut positions = [true, false, false];

        // Act
        let _ = token.advance(
            "é".as_bytes(),
            &mut positions,
            TEST_UNICODE_OPTIONS,
            HiddenNames::MatchAll,
        );

        // Assert
        assert_eq!(positions, [false, false, true]);
    }
}
