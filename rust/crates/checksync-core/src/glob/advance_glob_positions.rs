use super::advance_any_folders::advance_any_folders;
use super::advance_one_byte::advance_one_byte;
use super::advance_star::advance_star;
use super::types::{GlobOptions, GlobToken};

/// Move the reachable text positions past one glob token, in place.
///
/// # Arguments
///
/// * `token` - The token to match.
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the token.
/// * `options` - How to treat slashes and letter case.
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
) -> bool {
    match token {
        GlobToken::One(matcher) => advance_one_byte(matcher, text, positions, options),
        GlobToken::Star { crosses_slash } => advance_star(text, positions, *crosses_slash),
        GlobToken::AnyFolders => advance_any_folders(text, positions),
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{ByteMatcher, GlobOptions, GlobToken};
    use super::advance_glob_positions;

    const PATHNAME: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
    };

    #[test]
    fn moves_one_byte_for_a_single_byte_token() {
        // Arrange
        let token = GlobToken::One(ByteMatcher::Any);
        let mut positions = [true, false, false];

        // Act
        let _ = advance_glob_positions(&token, b"ab", &mut positions, PATHNAME);

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
        let _ = advance_glob_positions(&token, b"a/", &mut positions, PATHNAME);

        // Assert
        assert_eq!(positions, [true, true, false]);
    }

    #[test]
    fn spreads_to_folder_starts_for_any_folders() {
        // Arrange
        let token = GlobToken::AnyFolders;
        let mut positions = [true, false, false];

        // Act
        let _ = advance_glob_positions(&token, b"a/", &mut positions, PATHNAME);

        // Assert
        assert_eq!(positions, [true, false, true]);
    }

    #[test]
    fn reports_whether_any_position_is_reachable() {
        // Arrange
        let token = GlobToken::One(ByteMatcher::Literal(b'x'));
        let mut positions = [true, false];

        // Act
        let result = advance_glob_positions(&token, b"a", &mut positions, PATHNAME);

        // Assert
        assert!(!result);
    }
}
