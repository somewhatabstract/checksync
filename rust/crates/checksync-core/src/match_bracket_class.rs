use crate::matches_posix_class::matches_posix_class;
use crate::types::BracketClassMatch;

/// Match a byte against a bracket class, such as `[a-z]`, as git's
/// `wildmatch` does.
///
/// A leading `!` or `^` negates the class, and a `]` straight after the
/// opening `[` (or the negation) is an ordinary member. A backslash escapes
/// the next character, a `-` between two members makes a range (a `-` at the
/// end, or straight after a range, is an ordinary member), and `[:name:]` is
/// a POSIX class. With `pathname` set, a class never matches `/`.
///
/// # Arguments
///
/// * `pattern` - The whole pattern; a NUL byte ends it, as in git.
/// * `open` - The index of the class's opening `[`.
/// * `byte` - The byte to match, already lowercased if `casefold` is set.
/// * `casefold` - Whether case is ignored.
/// * `pathname` - Whether `/` separates folders, so the class can't match it.
///
/// # Returns
///
/// Whether the byte matched and, if so, the index of the class's closing `]`.
#[must_use]
pub(crate) fn match_bracket_class(
    pattern: &[u8],
    open: usize,
    byte: u8,
    casefold: bool,
    pathname: bool,
) -> BracketClassMatch {
    let at = |index: usize| pattern.get(index).copied().unwrap_or(0);
    let mut index = open + 1;
    let mut current = at(index);
    let negated = current == b'!' || current == b'^';
    if negated {
        index += 1;
        current = at(index);
    }
    let mut previous = 0;
    let mut matched = false;
    loop {
        if current == 0 {
            return BracketClassMatch::Abort;
        }
        if current == b'\\' {
            index += 1;
            current = at(index);
            if current == 0 {
                return BracketClassMatch::Abort;
            }
            matched |= byte == current;
        } else if current == b'-' && previous != 0 && at(index + 1) != 0 && at(index + 1) != b']' {
            index += 1;
            current = at(index);
            if current == b'\\' {
                index += 1;
                current = at(index);
                if current == 0 {
                    return BracketClassMatch::Abort;
                }
            }
            let upper = byte.to_ascii_uppercase();
            matched |= (previous..=current).contains(&byte)
                || (casefold && byte.is_ascii_lowercase() && (previous..=current).contains(&upper));
            // A range can't be the start of another range.
            current = 0;
        } else if current == b'[' && at(index + 1) == b':' {
            let name_start = index + 2;
            index = name_start;
            while at(index) != 0 && at(index) != b']' {
                index += 1;
            }
            if at(index) == 0 {
                return BracketClassMatch::Abort;
            }
            if index == name_start || pattern[index - 1] != b':' {
                // No `:]`, so the `[` is an ordinary member.
                index = name_start - 2;
                current = b'[';
                matched |= byte == current;
            } else {
                match matches_posix_class(&pattern[name_start..index - 1], byte, casefold) {
                    Some(member) => matched |= member,
                    None => return BracketClassMatch::Abort,
                }
                // A POSIX class can't be the start of a range.
                current = 0;
            }
        } else {
            matched |= byte == current;
        }
        previous = current;
        index += 1;
        current = at(index);
        if current == b']' {
            break;
        }
    }
    if matched == negated || (pathname && byte == b'/') {
        return BracketClassMatch::NoMatch;
    }
    BracketClassMatch::Matched { close: index }
}

#[cfg(test)]
mod tests {
    use super::match_bracket_class;
    use crate::types::BracketClassMatch;

    /// Match `byte` against the class at the start of `pattern`, ignoring
    /// neither case nor folders.
    fn class(pattern: &str, byte: u8) -> BracketClassMatch {
        match_bracket_class(pattern.as_bytes(), 0, byte, false, false)
    }

    #[test]
    fn matches_a_member_and_gives_the_closing_bracket() {
        // Arrange
        let pattern = "[abc]";

        // Act
        let result = class(pattern, b'b');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 4 });
    }

    #[test]
    fn rejects_a_byte_that_is_not_a_member() {
        // Arrange
        let pattern = "[abc]";

        // Act
        let result = class(pattern, b'd');

        // Assert
        assert_eq!(result, BracketClassMatch::NoMatch);
    }

    #[test]
    fn negates_with_an_exclamation_mark() {
        // Arrange
        let pattern = "[!a]";

        // Act
        let result = [class(pattern, b'a'), class(pattern, b'b')];

        // Assert
        assert_eq!(
            result,
            [
                BracketClassMatch::NoMatch,
                BracketClassMatch::Matched { close: 3 }
            ]
        );
    }

    #[test]
    fn negates_with_a_caret() {
        // Arrange
        let pattern = "[^a]";

        // Act
        let result = class(pattern, b'b');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 3 });
    }

    #[test]
    fn treats_a_leading_closing_bracket_as_a_member() {
        // Arrange
        let pattern = "[]a]";

        // Act
        let result = class(pattern, b']');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 3 });
    }

    #[test]
    fn treats_an_escaped_character_as_a_member() {
        // Arrange
        let pattern = r"[\]]";

        // Act
        let result = class(pattern, b']');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 3 });
    }

    #[test]
    fn aborts_on_a_backslash_at_the_end() {
        // Arrange
        let pattern = r"[a\";

        // Act
        let result = class(pattern, b'a');

        // Assert
        assert_eq!(result, BracketClassMatch::Abort);
    }

    #[test]
    fn aborts_on_an_unclosed_class() {
        // Arrange
        let pattern = "[ab";

        // Act
        let result = class(pattern, b'a');

        // Assert
        assert_eq!(result, BracketClassMatch::Abort);
    }

    #[test]
    fn matches_a_range() {
        // Arrange
        let pattern = "[a-c]";

        // Act
        let result = [class(pattern, b'b'), class(pattern, b'd')];

        // Assert
        assert_eq!(
            result,
            [
                BracketClassMatch::Matched { close: 4 },
                BracketClassMatch::NoMatch
            ]
        );
    }

    #[test]
    fn allows_an_escaped_end_to_a_range() {
        // Arrange
        let pattern = r"[a-\c]";

        // Act
        let result = class(pattern, b'b');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 5 });
    }

    #[test]
    fn aborts_on_a_backslash_at_the_end_of_a_range() {
        // Arrange
        let pattern = r"[a-\";

        // Act
        let result = class(pattern, b'b');

        // Assert
        assert_eq!(result, BracketClassMatch::Abort);
    }

    #[test]
    fn matches_a_lowercase_letter_in_an_uppercase_range_when_ignoring_case() {
        // Arrange
        let pattern = b"[A-C]";

        // Act
        let result = match_bracket_class(pattern, 0, b'b', true, false);

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 4 });
    }

    #[test]
    fn treats_a_trailing_dash_as_a_member() {
        // Arrange
        let pattern = "[a-]";

        // Act
        let result = class(pattern, b'-');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 3 });
    }

    #[test]
    fn treats_a_dash_after_a_range_as_a_member() {
        // Arrange
        let pattern = "[a-c-e]";

        // Act
        let result = [class(pattern, b'-'), class(pattern, b'd')];

        // Assert
        assert_eq!(
            result,
            [
                BracketClassMatch::Matched { close: 6 },
                BracketClassMatch::NoMatch
            ]
        );
    }

    #[test]
    fn matches_a_posix_class() {
        // Arrange
        let pattern = "[[:alpha:]]";

        // Act
        let result = [class(pattern, b'q'), class(pattern, b'1')];

        // Assert
        assert_eq!(
            result,
            [
                BracketClassMatch::Matched { close: 10 },
                BracketClassMatch::NoMatch
            ]
        );
    }

    #[test]
    fn aborts_on_an_unknown_posix_class() {
        // Arrange
        let pattern = "[[:word:]]";

        // Act
        let result = class(pattern, b'q');

        // Assert
        assert_eq!(result, BracketClassMatch::Abort);
    }

    #[test]
    fn treats_an_opening_bracket_without_a_closing_colon_as_a_member() {
        // Arrange
        let pattern = "[[:a]";

        // Act
        let result = [class(pattern, b'['), class(pattern, b':')];

        // Assert
        assert_eq!(
            result,
            [
                BracketClassMatch::Matched { close: 4 },
                BracketClassMatch::Matched { close: 4 }
            ]
        );
    }

    #[test]
    fn treats_an_empty_posix_class_name_as_ordinary_members() {
        // Arrange
        let pattern = "[[:]";

        // Act
        let result = class(pattern, b':');

        // Assert
        assert_eq!(result, BracketClassMatch::Matched { close: 3 });
    }

    #[test]
    fn aborts_on_an_unclosed_posix_class() {
        // Arrange
        let pattern = "[[:alpha";

        // Act
        let result = class(pattern, b'q');

        // Assert
        assert_eq!(result, BracketClassMatch::Abort);
    }

    #[test]
    fn never_matches_a_slash_with_folders() {
        // Arrange
        let pattern = b"[/]";

        // Act
        let result = [
            match_bracket_class(pattern, 0, b'/', false, true),
            match_bracket_class(pattern, 0, b'/', false, false),
        ];

        // Assert
        assert_eq!(
            result,
            [
                BracketClassMatch::NoMatch,
                BracketClassMatch::Matched { close: 2 }
            ]
        );
    }
}
