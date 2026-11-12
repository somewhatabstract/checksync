use super::advance_any_folders::advance_any_folders;
use super::advance_one_byte::advance_one_byte;
use super::advance_one_char::advance_one_char;
use super::advance_star::advance_star;
use super::types::{GlobOptions, GlobToken, HiddenNames};

/// Move the reachable text positions past one glob token, in place.
///
/// # Arguments
///
/// * `token` - The token to match.
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the token.
/// * `options` - How to treat slashes and letter case, and whether to read
///   the text as characters rather than bytes.
/// * `hidden` - Which hidden names wildcards may match.
///
/// # Returns
///
/// `true` if any position is reachable after the token.
#[must_use]
pub(super) fn advance_glob_positions(
    token: &GlobToken,
    text: &[u8],
    positions: &mut [bool],
    options: GlobOptions,
    hidden: HiddenNames,
) -> bool {
    let hides_dots = hidden == HiddenNames::SkipDotNames;
    match token {
        GlobToken::One(matcher) if options.unicode => {
            advance_one_char(matcher, text, positions, options, hides_dots)
        }
        GlobToken::One(matcher) => advance_one_byte(matcher, text, positions, options, hides_dots),
        GlobToken::Star { crosses_slash } => {
            advance_star(text, positions, *crosses_slash, hidden, options.unicode)
        }
        GlobToken::AnyFolders => advance_any_folders(text, positions, hidden),
    }
}

#[cfg(test)]
mod tests {
    use super::super::TEST_PATHNAME_OPTIONS;
    use super::super::TEST_UNICODE_OPTIONS;
    use super::super::types::{GlobToken, HiddenNames, UnitMatcher};
    use super::advance_glob_positions;

    #[test]
    fn moves_one_byte_for_a_single_byte_token() {
        // Arrange
        let token = GlobToken::One(UnitMatcher::Any);
        let mut positions = [true, false, false];

        // Act
        let _ = advance_glob_positions(
            &token,
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
        let _ = advance_glob_positions(
            &token,
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
        let _ = advance_glob_positions(
            &token,
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
        let result = advance_glob_positions(
            &token,
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
        let _ = advance_glob_positions(
            &token,
            "é".as_bytes(),
            &mut positions,
            TEST_UNICODE_OPTIONS,
            HiddenNames::MatchAll,
        );

        // Assert
        assert_eq!(positions, [false, false, true]);
    }
}
