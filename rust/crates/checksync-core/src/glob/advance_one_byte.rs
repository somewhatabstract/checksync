use super::starts_hidden_name::starts_hidden_name;
use super::types::{GlobOptions, UnitMatcher};
use super::unit_matcher_matches::unit_matcher_matches;
use super::unit_matcher_matches_hidden_dot::unit_matcher_matches_hidden_dot;

/// Move the reachable text positions past a single-byte token, in place.
///
/// This is the step for `?`, bracket sets and literals when not in unicode
/// mode. Each reachable position whose byte matches makes the position one byte
/// further on reachable; every other position becomes unreachable. When
/// `hides_dots` is set, a `.` starting a name only matches a token that
/// `unit_matcher_matches_hidden_dot` allows.
///
/// # Arguments
///
/// * `matcher` - What the byte has to be.
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the token.
/// * `options` - How to treat slashes and letter case.
/// * `hides_dots` - Whether wildcards stay off a `.` that starts a name.
///
/// # Returns
///
/// `true` if any position is reachable after the token.
#[must_use]
pub(super) fn advance_one_byte(
    matcher: &UnitMatcher,
    text: &[u8],
    positions: &mut [bool],
    options: GlobOptions,
    hides_dots: bool,
) -> bool {
    let may_match_hidden_dot = unit_matcher_matches_hidden_dot(matcher);
    let mut any = false;
    // Going backwards reads each position before it's overwritten.
    for (position, &byte) in text.iter().enumerate().rev() {
        let hidden = hides_dots && starts_hidden_name(text, position);
        let reached = positions[position]
            && (may_match_hidden_dot || !hidden)
            && unit_matcher_matches(
                matcher,
                &text[position..=position],
                u32::from(byte),
                options,
            );
        positions[position + 1] = reached;
        any |= reached;
    }
    positions[0] = false;
    any
}

#[cfg(test)]
mod tests {
    use super::super::types::UnitMatcher;
    use super::super::{TEST_OPTIONS, TEST_PATHNAME_OPTIONS};
    use super::advance_one_byte;

    #[test]
    fn moves_one_byte_past_each_reachable_matching_position() {
        // Arrange
        let mut positions = [true, false, true, false];

        // Act
        let _ = advance_one_byte(
            &UnitMatcher::Literal(b'a'),
            b"aaa",
            &mut positions,
            TEST_OPTIONS,
            false,
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
            &UnitMatcher::Literal(b'a'),
            b"b",
            &mut positions,
            TEST_OPTIONS,
            false,
        );

        // Assert
        assert_eq!(positions, [false, false]);
    }

    #[test]
    fn does_not_match_a_hidden_dot_with_a_question_mark_when_hiding_dots() {
        // Arrange
        let mut positions = [false, false, true, false];

        // Act
        let _ = advance_one_byte(
            &UnitMatcher::Any,
            b"a/.",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            true,
        );

        // Assert
        assert_eq!(positions, [false, false, false, false]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_literal_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = advance_one_byte(
            &UnitMatcher::Literal(b'.'),
            b".",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            true,
        );

        // Assert
        assert_eq!(positions, [false, true]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_question_mark_when_not_hiding_dots() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = advance_one_byte(
            &UnitMatcher::Any,
            b".",
            &mut positions,
            TEST_PATHNAME_OPTIONS,
            false,
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
            &UnitMatcher::Literal(b'a'),
            b"a",
            &mut positions,
            TEST_OPTIONS,
            false,
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
            &UnitMatcher::Literal(b'a'),
            b"b",
            &mut positions,
            TEST_OPTIONS,
            false,
        );

        // Assert
        assert!(!result);
    }
}
