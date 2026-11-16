use super::decode_glob_char::decode_glob_char;
use super::starts_hidden_name::starts_hidden_name;
use super::types::{GlobOptions, UnitMatcher};
use super::unit_matcher_matches::unit_matcher_matches;
use super::unit_matcher_matches_hidden_dot::unit_matcher_matches_hidden_dot;

/// Move the reachable text positions past a single-character token, in place.
///
/// This is the unicode-mode step for `?`, bracket sets and literals. Each
/// reachable position starts a character, as `decode_glob_char` reads
/// it; if the character matches, the position just past it becomes
/// reachable, and every other position becomes unreachable. When
/// `hides_dots` is set, a `.` starting a name only matches a token that
/// `unit_matcher_matches_hidden_dot` allows.
///
/// # Arguments
///
/// * `matcher` - What the character has to be.
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it, which is only ever the start of a
///   character. Updated to the positions reachable after the token.
/// * `options` - How to treat slashes and letter case.
/// * `hides_dots` - Whether wildcards stay off a `.` that starts a name.
///
/// # Returns
///
/// `true` if any position is reachable after the token.
#[must_use]
pub(super) fn advance_one_char(
    matcher: &UnitMatcher,
    text: &[u8],
    positions: &mut [bool],
    options: GlobOptions,
    hides_dots: bool,
) -> bool {
    let may_match_hidden_dot = unit_matcher_matches_hidden_dot(matcher);
    // Results waiting for positions just ahead; a character is at most 4
    // bytes, so 5 slots never collide.
    let mut arriving = [false; 5];
    let mut any = false;
    for position in 0..positions.len() {
        let here = positions[position];
        positions[position] = std::mem::take(&mut arriving[position % 5]);
        any |= positions[position];
        if !here || position == text.len() {
            continue;
        }
        let (code, length) = decode_glob_char(text, position);
        let hidden = hides_dots && starts_hidden_name(text, position);
        let unit = &text[position..position + length];
        arriving[(position + length) % 5] =
            (may_match_hidden_dot || !hidden) && unit_matcher_matches(matcher, unit, code, options);
    }
    any
}

#[cfg(test)]
mod tests {
    use super::super::TEST_UNICODE_OPTIONS;
    use super::super::types::{BracketItem, BracketSet, UnitMatcher};
    use super::advance_one_char;

    #[test]
    fn moves_past_a_whole_character() {
        // Arrange
        let text = "é😀".as_bytes();
        let mut positions = [true, false, false, false, false, false, false];

        // Act
        let _ = advance_one_char(
            &UnitMatcher::Any,
            text,
            &mut positions,
            TEST_UNICODE_OPTIONS,
            false,
        );

        // Assert
        assert_eq!(positions, [false, false, true, false, false, false, false]);
    }

    #[test]
    fn moves_past_a_four_byte_character() {
        // Arrange
        let text = "é😀".as_bytes();
        let mut positions = [false, false, true, false, false, false, false];

        // Act
        let _ = advance_one_char(
            &UnitMatcher::Any,
            text,
            &mut positions,
            TEST_UNICODE_OPTIONS,
            false,
        );

        // Assert
        assert_eq!(positions, [false, false, false, false, false, false, true]);
    }

    #[test]
    fn does_not_move_past_a_character_that_does_not_match() {
        // Arrange
        let text = "é".as_bytes();
        let mut positions = [true, false, false];
        let matcher = UnitMatcher::Set(BracketSet {
            negated: false,
            items: vec![BracketItem::Char(u32::from('e'))],
        });

        // Act
        let _ = advance_one_char(&matcher, text, &mut positions, TEST_UNICODE_OPTIONS, false);

        // Assert
        assert_eq!(positions, [false, false, false]);
    }

    #[test]
    fn does_not_match_a_hidden_dot_with_a_question_mark_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = advance_one_char(
            &UnitMatcher::Any,
            b".",
            &mut positions,
            TEST_UNICODE_OPTIONS,
            true,
        );

        // Assert
        assert_eq!(positions, [false, false]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_literal_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = advance_one_char(
            &UnitMatcher::Literal(b'.'),
            b".",
            &mut positions,
            TEST_UNICODE_OPTIONS,
            true,
        );

        // Assert
        assert_eq!(positions, [false, true]);
    }

    #[test]
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result = advance_one_char(
            &UnitMatcher::Any,
            b"a",
            &mut positions,
            TEST_UNICODE_OPTIONS,
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
        let result = advance_one_char(
            &UnitMatcher::Literal(b'x'),
            b"a",
            &mut positions,
            TEST_UNICODE_OPTIONS,
            false,
        );

        // Assert
        assert!(!result);
    }
}
