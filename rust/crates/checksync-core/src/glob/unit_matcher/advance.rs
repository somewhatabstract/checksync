//! Moving the reachable text positions past a single-unit token, byte by byte or
//! character by character.

use super::super::compiled_glob::GlobOptions;
use super::super::hidden_names::starts_hidden_name;
use super::super::units::decode_glob_char;
use super::UnitMatcher;

impl UnitMatcher {
    /// Moves the reachable text positions past this token, read as matching a byte, in place.
    ///
    /// This is the step for `?`, bracket sets and literals when not in unicode mode.
    /// `positions` holds, for each position in `text` from 0 to its length, whether
    /// matching can reach it. Each reachable position whose byte matches the token
    /// makes the position one byte further on reachable; every other position becomes
    /// unreachable. When `hides_dots` is set, a `.` starting a name only matches a
    /// token that [`UnitMatcher::matches_hidden_dot`] allows.
    ///
    /// Returns whether any position is reachable afterwards.
    #[must_use]
    pub(in crate::glob) fn advance_byte(
        &self,
        text: &[u8],
        positions: &mut [bool],
        options: GlobOptions,
        hides_dots: bool,
    ) -> bool {
        let may_match_hidden_dot = self.matches_hidden_dot();
        let mut any = false;
        // Going backwards reads each position before it's overwritten.
        for (position, &byte) in text.iter().enumerate().rev() {
            let hidden = hides_dots && starts_hidden_name(text, position);
            let reached = positions[position]
                && (may_match_hidden_dot || !hidden)
                && self.matches(&text[position..=position], u32::from(byte), options);
            positions[position + 1] = reached;
            any |= reached;
        }
        positions[0] = false;
        any
    }

    /// Moves the reachable text positions past this token, read as matching a character, in place.
    ///
    /// This is the unicode-mode step for `?`, bracket sets and literals. `positions`
    /// holds, for each position in `text` from 0 to its length, whether matching can
    /// reach it, which is only ever the start of a character, as
    /// [`decode_glob_char`] reads it. If the character at a reachable position matches
    /// the token, the position just past it becomes reachable, and every other
    /// position becomes unreachable. When `hides_dots` is set, a `.` starting a name
    /// only matches a token that [`UnitMatcher::matches_hidden_dot`] allows.
    ///
    /// Returns whether any position is reachable afterwards.
    #[must_use]
    pub(in crate::glob) fn advance_char(
        &self,
        text: &[u8],
        positions: &mut [bool],
        options: GlobOptions,
        hides_dots: bool,
    ) -> bool {
        let may_match_hidden_dot = self.matches_hidden_dot();
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
                (may_match_hidden_dot || !hidden) && self.matches(unit, code, options);
        }
        any
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::bracket_item::BracketItem;
    use super::super::super::bracket_set::BracketSet;
    use super::super::super::{TEST_OPTIONS, TEST_PATHNAME_OPTIONS, TEST_UNICODE_OPTIONS};
    use super::super::UnitMatcher;

    #[test]
    fn moves_one_byte_past_each_reachable_matching_position() {
        // Arrange
        let mut positions = [true, false, true, false];

        // Act
        let _ =
            UnitMatcher::Literal(b'a').advance_byte(b"aaa", &mut positions, TEST_OPTIONS, false);

        // Assert
        assert_eq!(positions, [false, true, false, true]);
    }

    #[test]
    fn does_not_move_past_a_byte_that_does_not_match() {
        // Arrange
        let mut positions = [true, true];

        // Act
        let _ = UnitMatcher::Literal(b'a').advance_byte(b"b", &mut positions, TEST_OPTIONS, false);

        // Assert
        assert_eq!(positions, [false, false]);
    }

    #[test]
    fn does_not_match_a_hidden_dot_with_a_question_mark_when_hiding_dots_as_a_byte() {
        // Arrange
        let mut positions = [false, false, true, false];

        // Act
        let _ =
            (UnitMatcher::Any).advance_byte(b"a/.", &mut positions, TEST_PATHNAME_OPTIONS, true);

        // Assert
        assert_eq!(positions, [false, false, false, false]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_literal_when_hiding_dots_as_a_byte() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = UnitMatcher::Literal(b'.').advance_byte(
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
        let _ = (UnitMatcher::Any).advance_byte(b".", &mut positions, TEST_PATHNAME_OPTIONS, false);

        // Assert
        assert_eq!(positions, [false, true]);
    }

    #[test]
    fn reports_a_reachable_position_as_a_byte() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result =
            UnitMatcher::Literal(b'a').advance_byte(b"a", &mut positions, TEST_OPTIONS, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable_as_a_byte() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result =
            UnitMatcher::Literal(b'a').advance_byte(b"b", &mut positions, TEST_OPTIONS, false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn moves_past_a_whole_character() {
        // Arrange
        let text = "é😀".as_bytes();
        let mut positions = [true, false, false, false, false, false, false];

        // Act
        let _ = (UnitMatcher::Any).advance_char(text, &mut positions, TEST_UNICODE_OPTIONS, false);

        // Assert
        assert_eq!(positions, [false, false, true, false, false, false, false]);
    }

    #[test]
    fn moves_past_a_four_byte_character() {
        // Arrange
        let text = "é😀".as_bytes();
        let mut positions = [false, false, true, false, false, false, false];

        // Act
        let _ = (UnitMatcher::Any).advance_char(text, &mut positions, TEST_UNICODE_OPTIONS, false);

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
        let _ = matcher.advance_char(text, &mut positions, TEST_UNICODE_OPTIONS, false);

        // Assert
        assert_eq!(positions, [false, false, false]);
    }

    #[test]
    fn does_not_match_a_hidden_dot_with_a_question_mark_when_hiding_dots_as_a_character() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = (UnitMatcher::Any).advance_char(b".", &mut positions, TEST_UNICODE_OPTIONS, true);

        // Assert
        assert_eq!(positions, [false, false]);
    }

    #[test]
    fn matches_a_hidden_dot_with_a_literal_when_hiding_dots_as_a_character() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let _ = UnitMatcher::Literal(b'.').advance_char(
            b".",
            &mut positions,
            TEST_UNICODE_OPTIONS,
            true,
        );

        // Assert
        assert_eq!(positions, [false, true]);
    }

    #[test]
    fn reports_a_reachable_position_as_a_character() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result =
            (UnitMatcher::Any).advance_char(b"a", &mut positions, TEST_UNICODE_OPTIONS, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable_as_a_character() {
        // Arrange
        let mut positions = [true, false];

        // Act
        let result = UnitMatcher::Literal(b'x').advance_char(
            b"a",
            &mut positions,
            TEST_UNICODE_OPTIONS,
            false,
        );

        // Assert
        assert!(!result);
    }
}
