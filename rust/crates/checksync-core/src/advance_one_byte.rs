use crate::byte_matcher_matches::byte_matcher_matches;
use crate::types::{ByteMatcher, GlobOptions};

/// Find where in the text matching moves to after a single-byte token.
///
/// # Arguments
///
/// * `matcher` - What the byte has to be.
/// * `text` - The text being matched.
/// * `reachable` - For each position in the text, from 0 to its length,
///   whether matching can have reached it before this token.
/// * `options` - How to treat slashes and letter case.
///
/// # Returns
///
/// For each position in the text, whether matching can reach it after the
/// token: one byte past a reachable position whose byte matches.
#[must_use]
pub(crate) fn advance_one_byte(
    matcher: &ByteMatcher,
    text: &[u8],
    reachable: &[bool],
    options: GlobOptions,
) -> Vec<bool> {
    let mut next = vec![false; reachable.len()];
    for (position, &byte) in text.iter().enumerate() {
        next[position + 1] = reachable[position] && byte_matcher_matches(matcher, byte, options);
    }
    next
}

#[cfg(test)]
mod tests {
    use super::advance_one_byte;
    use crate::types::{ByteMatcher, GlobOptions};

    #[test]
    fn moves_one_byte_past_each_reachable_matching_position() {
        // Arrange
        let reachable = [true, false, true, false];

        // Act
        let result = advance_one_byte(
            &ByteMatcher::Literal(b'a'),
            b"aaa",
            &reachable,
            GlobOptions::default(),
        );

        // Assert
        assert_eq!(result, vec![false, true, false, true]);
    }

    #[test]
    fn does_not_move_past_a_byte_that_does_not_match() {
        // Arrange
        let reachable = [true, true];

        // Act
        let result = advance_one_byte(
            &ByteMatcher::Literal(b'a'),
            b"b",
            &reachable,
            GlobOptions::default(),
        );

        // Assert
        assert_eq!(result, vec![false, false]);
    }
}
