use super::byte_matcher_matches::byte_matcher_matches;
use super::types::{ByteMatcher, GlobOptions};

/// Move the reachable text positions past a single-byte token, in place.
///
/// Each reachable position whose byte matches makes the position one byte
/// further on reachable; every other position becomes unreachable.
///
/// # Arguments
///
/// * `matcher` - What the byte has to be.
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
pub(super) fn advance_one_byte(
    matcher: &ByteMatcher,
    text: &[u8],
    positions: &mut [bool],
    options: GlobOptions,
) -> bool {
    let mut any = false;
    // Going backwards reads each position before it's overwritten.
    for (position, &byte) in text.iter().enumerate().rev() {
        let reached = positions[position] && byte_matcher_matches(matcher, byte, options);
        positions[position + 1] = reached;
        any |= reached;
    }
    positions[0] = false;
    any
}

#[cfg(test)]
mod tests {
    use super::super::types::{ByteMatcher, GlobOptions};
    use super::advance_one_byte;

    #[test]
    fn moves_one_byte_past_each_reachable_matching_position() {
        // Arrange
        let mut positions = [true, false, true, false];

        // Act
        let _ = advance_one_byte(
            &ByteMatcher::Literal(b'a'),
            b"aaa",
            &mut positions,
            GlobOptions::default(),
        );

        // Assert
        assert_eq!(positions, [false, true, false, true]);
    }

    #[test]
    fn does_not_move_past_a_byte_that_does_not_match() {
        // Arrange
        let mut positions = [true, true];

        // Act
        let _ = advance_one_byte(
            &ByteMatcher::Literal(b'a'),
            b"b",
            &mut positions,
            GlobOptions::default(),
        );

        // Assert
        assert_eq!(positions, [false, false]);
    }

    #[test]
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result = advance_one_byte(
            &ByteMatcher::Literal(b'a'),
            b"a",
            &mut positions,
            GlobOptions::default(),
        );

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result = advance_one_byte(
            &ByteMatcher::Literal(b'a'),
            b"b",
            &mut positions,
            GlobOptions::default(),
        );

        // Assert
        assert!(!result);
    }
}
