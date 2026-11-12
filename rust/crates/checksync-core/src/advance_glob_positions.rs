use crate::advance_any_folders::advance_any_folders;
use crate::advance_one_byte::advance_one_byte;
use crate::advance_star::advance_star;
use crate::types::{GlobOptions, GlobToken};

/// Find where in the text matching moves to after one glob token.
///
/// # Arguments
///
/// * `token` - The token to match.
/// * `text` - The text being matched.
/// * `reachable` - For each position in the text, from 0 to its length,
///   whether matching can have reached it before the token.
/// * `options` - How to treat slashes and letter case.
///
/// # Returns
///
/// For each position in the text, whether matching can reach it after the
/// token.
#[must_use]
pub(crate) fn advance_glob_positions(
    token: &GlobToken,
    text: &[u8],
    reachable: &[bool],
    options: GlobOptions,
) -> Vec<bool> {
    match token {
        GlobToken::One(matcher) => advance_one_byte(matcher, text, reachable, options),
        GlobToken::Star { crosses_slash } => advance_star(text, reachable, *crosses_slash),
        GlobToken::AnyFolders => advance_any_folders(text, reachable),
    }
}

#[cfg(test)]
mod tests {
    use super::advance_glob_positions;
    use crate::types::{ByteMatcher, GlobOptions, GlobToken};

    const PATHNAME: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
    };

    #[test]
    fn moves_one_byte_for_a_single_byte_token() {
        // Arrange
        let token = GlobToken::One(ByteMatcher::Any);

        // Act
        let result = advance_glob_positions(&token, b"ab", &[true, false, false], PATHNAME);

        // Assert
        assert_eq!(result, vec![false, true, false]);
    }

    #[test]
    fn spreads_within_a_folder_for_a_star() {
        // Arrange
        let token = GlobToken::Star {
            crosses_slash: false,
        };

        // Act
        let result = advance_glob_positions(&token, b"a/", &[true, false, false], PATHNAME);

        // Assert
        assert_eq!(result, vec![true, true, false]);
    }

    #[test]
    fn spreads_to_folder_starts_for_any_folders() {
        // Arrange
        let token = GlobToken::AnyFolders;

        // Act
        let result = advance_glob_positions(&token, b"a/", &[true, false, false], PATHNAME);

        // Assert
        assert_eq!(result, vec![true, false, true]);
    }
}
