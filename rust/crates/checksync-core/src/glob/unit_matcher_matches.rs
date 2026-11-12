use super::bracket_set_contains::bracket_set_contains;
use super::types::{GlobOptions, UnitMatcher};

/// Check whether one unit of the text matches a single-unit glob token.
///
/// A unit is a byte, or a whole character in unicode mode. With `pathname`
/// set, `?` and bracket sets never match `/`; only a literal `/` does. With
/// `casefold` set, a literal matches in either case, but an escaped byte is
/// compared with the text's byte lowercased.
///
/// # Arguments
///
/// * `matcher` - What the unit has to be.
/// * `unit` - The unit's bytes in the text.
/// * `code` - The unit's code: the byte, or the character's code point.
/// * `options` - How to treat slashes and letter case.
///
/// # Returns
///
/// `true` if the unit matches.
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

#[cfg(test)]
mod tests {
    use super::super::TEST_OPTIONS;
    use super::super::TEST_PATHNAME_OPTIONS;
    use super::super::types::{BracketItem, BracketSet, GlobOptions, UnitMatcher};
    use super::unit_matcher_matches;

    const CASEFOLD: GlobOptions = GlobOptions {
        pathname: false,
        casefold: true,
        dot: true,
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
}
