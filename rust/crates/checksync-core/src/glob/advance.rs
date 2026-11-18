//! Moving the reachable text positions past glob tokens, and past single-unit
//! tokens in particular.

use super::advance_wildcards::{advance_any_folders, advance_star};
use super::compiled_glob::GlobOptions;
use super::hidden_names::{HiddenNames, starts_hidden_name};
use super::tokenize::GlobToken;
use super::unit_matcher::{UnitMatcher, unit_matcher_matches, unit_matcher_matches_hidden_dot};
use super::units::decode_glob_char;

/// Moves the reachable text positions past one glob token, in place.
///
/// `positions` holds, for each position in `text` from 0 to its length, whether
/// matching can reach it, and is updated to the positions reachable after
/// `token`. `options` says how to treat slashes and letter case, and whether to
/// read the text as characters rather than bytes; `hidden` says which hidden
/// names wildcards may match.
///
/// Returns whether any position is reachable afterwards.
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

/// Moves the reachable text positions past a single-byte token, in place.
///
/// This is the step for `?`, bracket sets and literals when not in unicode mode.
/// `positions` holds, for each position in `text` from 0 to its length, whether
/// matching can reach it. Each reachable position whose byte matches `matcher`
/// makes the position one byte further on reachable; every other position becomes
/// unreachable. When `hides_dots` is set, a `.` starting a name only matches a
/// token that [`unit_matcher_matches_hidden_dot`] allows.
///
/// Returns whether any position is reachable afterwards.
#[must_use]
fn advance_one_byte(
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

/// Moves the reachable text positions past a single-character token, in place.
///
/// This is the unicode-mode step for `?`, bracket sets and literals. `positions`
/// holds, for each position in `text` from 0 to its length, whether matching can
/// reach it, which is only ever the start of a character, as
/// [`decode_glob_char`] reads it. If the character at a reachable position matches
/// `matcher`, the position just past it becomes reachable, and every other
/// position becomes unreachable. When `hides_dots` is set, a `.` starting a name
/// only matches a token that [`unit_matcher_matches_hidden_dot`] allows.
///
/// Returns whether any position is reachable afterwards.
#[must_use]
fn advance_one_char(
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
    use super::super::hidden_names::HiddenNames;
    use super::super::tokenize::GlobToken;
    use super::super::unit_matcher::UnitMatcher;
    use super::super::{TEST_OPTIONS, TEST_PATHNAME_OPTIONS, TEST_UNICODE_OPTIONS};
    use super::{advance_glob_positions, advance_one_byte};

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

#[cfg(test)]
mod advance_one_char_tests {
    use super::super::TEST_UNICODE_OPTIONS;
    use super::super::bracket_item::BracketItem;
    use super::super::bracket_set::BracketSet;
    use super::super::unit_matcher::UnitMatcher;
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
