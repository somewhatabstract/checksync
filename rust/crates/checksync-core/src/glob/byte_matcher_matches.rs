use super::bracket_set_contains::bracket_set_contains;
use super::types::{ByteMatcher, GlobOptions};

/// Check whether one byte of the text matches a single-byte glob token.
///
/// With `pathname` set, `?` and bracket sets never match `/`; only a
/// literal `/` does. With `casefold` set, a literal matches in either case,
/// but an escaped byte is compared with the text's byte lowercased.
///
/// # Arguments
///
/// * `matcher` - What the byte has to be.
/// * `byte` - The byte of the text.
/// * `options` - How to treat slashes and letter case.
///
/// # Returns
///
/// `true` if the byte matches.
#[must_use]
pub(super) fn byte_matcher_matches(matcher: &ByteMatcher, byte: u8, options: GlobOptions) -> bool {
    let is_separator = options.pathname && byte == b'/';
    match matcher {
        ByteMatcher::Literal(expected) if options.casefold => expected.eq_ignore_ascii_case(&byte),
        ByteMatcher::Escaped(expected) if options.casefold => {
            *expected == byte.to_ascii_lowercase()
        }
        ByteMatcher::Literal(expected) | ByteMatcher::Escaped(expected) => *expected == byte,
        ByteMatcher::Any => !is_separator,
        ByteMatcher::Set(set) => !is_separator && bracket_set_contains(set, byte, options.casefold),
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{BracketItem, BracketSet, ByteMatcher, GlobOptions};
    use super::byte_matcher_matches;

    const PATHNAME: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
        dot: true,
    };

    const CASEFOLD: GlobOptions = GlobOptions {
        pathname: false,
        casefold: true,
        dot: true,
    };

    fn slash_set() -> ByteMatcher {
        ByteMatcher::Set(BracketSet {
            negated: false,
            items: vec![BracketItem::Byte(b'/')],
        })
    }

    #[test]
    fn matches_the_same_literal_byte() {
        // Arrange
        let matcher = ByteMatcher::Literal(b'a');

        // Act
        let result = byte_matcher_matches(&matcher, b'a', GlobOptions::default());

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_literal_in_another_case() {
        // Arrange
        let matcher = ByteMatcher::Literal(b'a');

        // Act
        let result = byte_matcher_matches(&matcher, b'A', GlobOptions::default());

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_literal_in_another_case_when_folding_case() {
        // Arrange
        let matcher = ByteMatcher::Literal(b'A');

        // Act
        let result = byte_matcher_matches(&matcher, b'a', CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_the_same_escaped_byte() {
        // Arrange
        let matcher = ByteMatcher::Escaped(b'A');

        // Act
        let result = byte_matcher_matches(&matcher, b'A', GlobOptions::default());

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_lowercase_letter_in_another_case_when_folding_case() {
        // Arrange
        let matcher = ByteMatcher::Escaped(b'a');

        // Act
        let result = byte_matcher_matches(&matcher, b'A', CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_an_escaped_uppercase_letter_when_folding_case() {
        // Arrange
        let matcher = ByteMatcher::Escaped(b'A');

        // Act
        let result = byte_matcher_matches(&matcher, b'A', CASEFOLD);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_literal_slash_in_pathname_mode() {
        // Arrange
        let matcher = ByteMatcher::Literal(b'/');

        // Act
        let result = byte_matcher_matches(&matcher, b'/', PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_byte_with_a_question_mark() {
        // Arrange
        let matcher = ByteMatcher::Any;

        // Act
        let result = byte_matcher_matches(&matcher, b'/', GlobOptions::default());

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_question_mark_in_pathname_mode() {
        // Arrange
        let matcher = ByteMatcher::Any;

        // Act
        let result = byte_matcher_matches(&matcher, b'/', PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_slash_with_a_set_containing_it() {
        // Arrange
        let matcher = slash_set();

        // Act
        let result = byte_matcher_matches(&matcher, b'/', GlobOptions::default());

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_set_in_pathname_mode() {
        // Arrange
        let matcher = slash_set();

        // Act
        let result = byte_matcher_matches(&matcher, b'/', PATHNAME);

        // Assert
        assert!(!result);
    }
}
