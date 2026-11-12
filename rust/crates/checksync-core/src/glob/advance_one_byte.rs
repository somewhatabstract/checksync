use super::byte_matcher_matches::byte_matcher_matches;
use super::byte_matcher_matches_hidden_dot::byte_matcher_matches_hidden_dot;
use super::starts_hidden_name::starts_hidden_name;
use super::types::{ByteMatcher, GlobOptions};

/// Move the reachable text positions past a single-byte token, in place.
///
/// Each reachable position whose byte matches makes the position one byte
/// further on reachable; every other position becomes unreachable. When
/// `options` protect hidden names, a `.` starting a name only matches a
/// token that `byte_matcher_matches_hidden_dot` allows.
///
/// # Arguments
///
/// * `matcher` - What the byte has to be.
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the token.
/// * `options` - How to treat slashes, letter case and hidden names.
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
    let hides_dots = options.pathname && !options.dot;
    let may_match_hidden_dot = byte_matcher_matches_hidden_dot(matcher);
    let mut any = false;
    // Going backwards reads each position before it's overwritten.
    for (position, &byte) in text.iter().enumerate().rev() {
        let hidden = hides_dots && starts_hidden_name(text, position);
        let reached = positions[position]
            && (may_match_hidden_dot || !hidden)
            && byte_matcher_matches(matcher, byte, options);
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
    fn does_not_match_a_hidden_dot_with_a_question_mark_when_hiding_dots() {
        // Arrange
        let mut positions = [false, false, true, false];
        let options = GlobOptions {
            pathname: true,
            casefold: false,
            dot: false,
        };

        // Act
        let _ = advance_one_byte(&ByteMatcher::Any, b"a/.", &mut positions, options);

        // Assert
        assert_eq!(positions, [false, false, false, false]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_literal_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false];
        let options = GlobOptions {
            pathname: true,
            casefold: false,
            dot: false,
        };

        // Act
        let _ = advance_one_byte(&ByteMatcher::Literal(b'.'), b".", &mut positions, options);

        // Assert
        assert_eq!(positions, [false, true]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_question_mark_when_allowing_dots() {
        // Arrange
        let mut positions = [true, false];
        let options = GlobOptions {
            pathname: true,
            casefold: false,
            dot: true,
        };

        // Act
        let _ = advance_one_byte(&ByteMatcher::Any, b".", &mut positions, options);

        // Assert
        assert_eq!(positions, [false, true]);
    }

    #[test]
    fn matches_a_leading_dot_with_a_question_mark_without_pathname_mode() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = advance_one_byte(
            &ByteMatcher::Any,
            b".",
            &mut positions,
            GlobOptions::default(),
        );

        // Assert
        assert_eq!(positions, [false, true]);
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
