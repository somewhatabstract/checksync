//! Matching one unit of a text, a byte or a character, against a single-unit
//! token.

use super::bracket_set::{BracketSet, bracket_set_contains};
use super::compiled_glob::GlobOptions;

/// What one unit of the text has to be to match one glob token.
///
/// A unit is a byte, or a whole character in unicode mode.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum UnitMatcher {
    /// This byte, in either case when folding case.
    Literal(u8),
    /// This byte, written after a `\`.
    ///
    /// When folding case, the text's byte is lowercased and then compared exactly, so
    /// an escaped uppercase letter matches nothing.
    Escaped(u8),
    /// This character of several bytes, escaped or not, in unicode mode.
    Character(Vec<u8>),
    /// Any one unit, written as `?`.
    Any,
    /// A unit from a bracket set, such as `[a-z]`.
    Set(BracketSet),
}

/// Checks whether one unit of the text matches a single-unit glob token.
///
/// A unit is a byte, or a whole character in unicode mode; `unit` holds its bytes
/// in the text and `code` its code, the byte or the character's code point. With
/// `pathname` set in `options`, `?` and bracket sets never match `/`; only a
/// literal `/` does. With `casefold` set, a literal matches in either case, but
/// an escaped byte is compared with the text's byte lowercased.
#[must_use]
pub(super) fn unit_matcher_matches(
    matcher: &UnitMatcher,
    unit: &[u8],
    code: u32,
    options: GlobOptions,
) -> bool {
    let is_separator = options.pathname && unit == b"/";
    match (matcher, unit) {
        (UnitMatcher::Literal(expected), [byte]) if options.casefold => {
            expected.eq_ignore_ascii_case(byte)
        }
        (UnitMatcher::Escaped(expected), [byte]) if options.casefold => {
            *expected == byte.to_ascii_lowercase()
        }
        (UnitMatcher::Literal(expected) | UnitMatcher::Escaped(expected), [byte]) => {
            expected == byte
        }
        (UnitMatcher::Literal(_) | UnitMatcher::Escaped(_), _) => false,
        (UnitMatcher::Character(expected), _) => expected == unit,
        (UnitMatcher::Any, _) => !is_separator,
        (UnitMatcher::Set(set), _) => {
            !is_separator && bracket_set_contains(set, code, options.casefold)
        }
    }
}

/// Checks whether a single-unit token may match a hidden name's leading `.`.
///
/// This applies when hidden names are protected. A literal or escaped unit and a
/// bracket set that isn't negated may, so they match it if they match a `.` at
/// all; `?` and negated sets may not.
#[must_use]
pub(super) fn unit_matcher_matches_hidden_dot(matcher: &UnitMatcher) -> bool {
    match matcher {
        UnitMatcher::Literal(_) | UnitMatcher::Escaped(_) | UnitMatcher::Character(_) => true,
        UnitMatcher::Any => false,
        UnitMatcher::Set(set) => !set.negated,
    }
}

#[cfg(test)]
mod tests {
    use super::super::bracket_item::BracketItem;
    use super::super::bracket_set::BracketSet;
    use super::super::compiled_glob::GlobOptions;
    use super::super::hidden_names::HiddenNames;
    use super::super::{TEST_OPTIONS, TEST_PATHNAME_OPTIONS};
    use super::{UnitMatcher, unit_matcher_matches, unit_matcher_matches_hidden_dot};

    const CASEFOLD: GlobOptions = GlobOptions {
        pathname: false,
        casefold: true,
        hidden: HiddenNames::MatchAll,
        unicode: false,
    };

    fn slash_set() -> UnitMatcher {
        UnitMatcher::Set(BracketSet {
            negated: false,
            items: vec![BracketItem::Char(u32::from(b'/'))],
        })
    }

    #[test]
    fn matches_the_same_literal_byte() {
        // Arrange
        let matcher = UnitMatcher::Literal(b'a');

        // Act
        let result = unit_matcher_matches(&matcher, b"a", u32::from(b'a'), TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_literal_in_another_case() {
        // Arrange
        let matcher = UnitMatcher::Literal(b'a');

        // Act
        let result = unit_matcher_matches(&matcher, b"A", u32::from(b'A'), TEST_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_literal_in_another_case_when_folding_case() {
        // Arrange
        let matcher = UnitMatcher::Literal(b'A');

        // Act
        let result = unit_matcher_matches(&matcher, b"a", u32::from(b'a'), CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_the_same_escaped_byte() {
        // Arrange
        let matcher = UnitMatcher::Escaped(b'A');

        // Act
        let result = unit_matcher_matches(&matcher, b"A", u32::from(b'A'), TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_lowercase_letter_in_another_case_when_folding_case() {
        // Arrange
        let matcher = UnitMatcher::Escaped(b'a');

        // Act
        let result = unit_matcher_matches(&matcher, b"A", u32::from(b'A'), CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_an_escaped_uppercase_letter_when_folding_case() {
        // Arrange
        let matcher = UnitMatcher::Escaped(b'A');

        // Act
        let result = unit_matcher_matches(&matcher, b"A", u32::from(b'A'), CASEFOLD);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_literal_slash_in_pathname_mode() {
        // Arrange
        let matcher = UnitMatcher::Literal(b'/');

        // Act
        let result = unit_matcher_matches(&matcher, b"/", u32::from(b'/'), TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_byte_with_a_question_mark() {
        // Arrange
        let matcher = UnitMatcher::Any;

        // Act
        let result = unit_matcher_matches(&matcher, b"/", u32::from(b'/'), TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_question_mark_in_pathname_mode() {
        // Arrange
        let matcher = UnitMatcher::Any;

        // Act
        let result = unit_matcher_matches(&matcher, b"/", u32::from(b'/'), TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_slash_with_a_set_containing_it() {
        // Arrange
        let matcher = slash_set();

        // Act
        let result = unit_matcher_matches(&matcher, b"/", u32::from(b'/'), TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_set_in_pathname_mode() {
        // Arrange
        let matcher = slash_set();

        // Act
        let result = unit_matcher_matches(&matcher, b"/", u32::from(b'/'), TEST_PATHNAME_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_a_character_with_a_single_byte_literal() {
        // Arrange
        let matcher = UnitMatcher::Literal(0xC3);

        // Act
        let result = unit_matcher_matches(&matcher, "é".as_bytes(), u32::from('é'), TEST_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_the_same_character() {
        // Arrange
        let matcher = UnitMatcher::Character("é".as_bytes().to_vec());

        // Act
        let result = unit_matcher_matches(&matcher, "é".as_bytes(), u32::from('é'), TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_different_character() {
        // Arrange
        let matcher = UnitMatcher::Character("é".as_bytes().to_vec());

        // Act
        let result = unit_matcher_matches(&matcher, "è".as_bytes(), u32::from('è'), TEST_OPTIONS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_character_from_a_set_by_code_point() {
        // Arrange
        let matcher = UnitMatcher::Set(BracketSet {
            negated: false,
            items: vec![BracketItem::Range(u32::from('à'), u32::from('ÿ'))],
        });

        // Act
        let result = unit_matcher_matches(&matcher, "é".as_bytes(), u32::from('é'), TEST_OPTIONS);

        // Assert
        assert!(result);
    }

    fn set(negated: bool) -> UnitMatcher {
        UnitMatcher::Set(BracketSet {
            negated,
            items: vec![BracketItem::Char(u32::from(b'.'))],
        })
    }

    #[test]
    fn allows_a_literal() {
        // Arrange
        let matcher = UnitMatcher::Literal(b'.');

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn allows_an_escaped_byte() {
        // Arrange
        let matcher = UnitMatcher::Escaped(b'.');

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn refuses_a_question_mark() {
        // Arrange
        let matcher = UnitMatcher::Any;

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(!result);
    }

    #[test]
    fn allows_a_set() {
        // Arrange
        let matcher = set(false);

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn refuses_a_negated_set() {
        // Arrange
        let matcher = set(true);

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(!result);
    }
}
