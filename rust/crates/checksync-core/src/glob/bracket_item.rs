//! The members of a bracket set: reading them and matching units against them.

use super::posix_class::{ClassSyntax, PosixClass};
use super::units::read_glob_char;

/// One member of a bracket set.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum BracketItem {
    /// A single unit, by its code: a byte, or a code point in unicode mode.
    Char(u32),
    /// A range of units, from the first code to the second, as written.
    Range(u32, u32),
    /// A POSIX character class, such as `[:alpha:]`.
    Class(PosixClass),
}

impl BracketItem {
    /// Reads one member of a bracket set: a POSIX class, a range or a unit.
    ///
    /// `index`, where the member starts, must be within `pattern`. A unit is a byte,
    /// or with `unicode` a whole character, as [`read_glob_char`] reads it. A `[:`
    /// starts a class only if [`ClassSyntax::read`] says so; otherwise its `[` is an
    /// ordinary unit. A unit followed by `-` and then anything but `]` starts a
    /// range, and either end of a range can be escaped with `\`. A class can't start
    /// or end a range, so a `-` after a class is literal, and a `[` after a `-` is
    /// just the end of the range.
    ///
    /// Returns the member and the index just past it, or `None` if the member is
    /// malformed: an unknown class name, or a `\` at the end of the pattern.
    #[must_use]
    pub(super) fn read(pattern: &[u8], index: usize, unicode: bool) -> Option<(Self, usize)> {
        if pattern[index] == b'[' && pattern.get(index + 1) == Some(&b':') {
            match ClassSyntax::read(pattern, index) {
                ClassSyntax::Known(class, next) => return Some((BracketItem::Class(class), next)),
                ClassSyntax::Unknown => return None,
                ClassSyntax::NotAClass => {}
            }
        }
        let (start, unit) = read_glob_char(pattern, index, unicode)?;
        let next = unit.end;
        let starts_range = pattern.get(next) == Some(&b'-')
            && pattern.get(next + 1).is_some_and(|&byte| byte != b']');
        if !starts_range {
            return Some((BracketItem::Char(start), next));
        }
        let (end, unit) = read_glob_char(pattern, next + 1, unicode)?;
        Some((BracketItem::Range(start, end), unit.end))
    }

    /// Checks whether a unit of the text matches this member of a bracket set.
    ///
    /// Units are compared by `code`: a byte, or a code point in unicode mode. A range
    /// always matches its first code, even when it's written backwards (so `[z-a]`
    /// matches only `z`), and otherwise matches the codes from its first to its last.
    /// When `casefold` is set, the caller passes an ASCII letter already lowercased; a
    /// single member then matches only as written, while a range or class also
    /// matches if the letter's uppercase form is inside it, so `[A-Z]` and
    /// `[:upper:]` match `a` but `[A]` doesn't. Classes only ever hold ASCII.
    #[must_use]
    pub(super) fn matches(self, code: u32, casefold: bool) -> bool {
        let upper = u8::try_from(code).map_or(code, |byte| u32::from(byte.to_ascii_uppercase()));
        let in_class = |class: PosixClass, code: u32| {
            u8::try_from(code).is_ok_and(|byte| class.contains(byte))
        };
        match self {
            BracketItem::Char(member) => code == member,
            BracketItem::Range(first, last) => {
                let range = first..=last;
                code == first || range.contains(&code) || (casefold && range.contains(&upper))
            }
            BracketItem::Class(class) => {
                in_class(class, code) || (casefold && in_class(class, upper))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::posix_class::PosixClass;
    use super::BracketItem;

    #[test]
    fn reads_a_byte() {
        // Arrange
        let pattern = b"[ab]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'a')), 2)));
    }

    #[test]
    fn reads_an_escaped_byte() {
        // Arrange
        let pattern = b"[\\]]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b']')), 3)));
    }

    #[test]
    fn reads_a_range() {
        // Arrange
        let pattern = b"[a-z]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(
            result,
            Some((BracketItem::Range(u32::from(b'a'), u32::from(b'z')), 4))
        );
    }

    #[test]
    fn reads_a_range_with_escaped_ends() {
        // Arrange
        let pattern = b"[\\a-\\z]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(
            result,
            Some((BracketItem::Range(u32::from(b'a'), u32::from(b'z')), 6))
        );
    }

    #[test]
    fn reads_a_dash_before_the_closing_bracket_as_a_separate_byte() {
        // Arrange
        let pattern = b"[a-]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'a')), 2)));
    }

    #[test]
    fn reads_a_dash_at_the_end_of_the_pattern_as_a_separate_byte() {
        // Arrange
        let pattern = b"[a-";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'a')), 2)));
    }

    #[test]
    fn reads_an_opening_bracket_as_the_end_of_a_range() {
        // Arrange
        let pattern = b"[a-[:upper:]]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(
            result,
            Some((BracketItem::Range(u32::from(b'a'), u32::from(b'[')), 4))
        );
    }

    #[test]
    fn reads_a_known_class() {
        // Arrange
        let pattern = b"[[:digit:]-z]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Class(PosixClass::Digit), 10)));
    }

    #[test]
    fn rejects_an_unknown_class() {
        // Arrange
        let pattern = b"[[:foo:]]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn reads_an_opening_bracket_that_does_not_start_a_class_as_a_byte() {
        // Arrange
        let pattern = b"[[:a]";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'[')), 2)));
    }

    #[test]
    fn reads_an_opening_bracket_at_the_end_of_the_pattern_as_a_byte() {
        // Arrange
        let pattern = b"[[";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'[')), 2)));
    }

    #[test]
    fn rejects_a_backslash_at_the_end_of_the_pattern() {
        // Arrange
        let pattern = b"[\\";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_range_ending_in_a_backslash_at_the_end_of_the_pattern() {
        // Arrange
        let pattern = b"[a-\\";

        // Act
        let result = BracketItem::read(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn reads_a_range_of_characters_with_unicode() {
        // Arrange
        let pattern = "[à-ÿ]".as_bytes();

        // Act
        let result = BracketItem::read(pattern, 1, true);

        // Assert
        assert_eq!(
            result,
            Some((BracketItem::Range(u32::from('à'), u32::from('ÿ')), 6))
        );
    }

    #[test]
    fn matches_the_same_byte() {
        // Arrange
        let item = BracketItem::Char(u32::from(b'a'));

        // Act
        let result = item.matches(u32::from(b'a'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_different_byte() {
        // Arrange
        let item = BracketItem::Char(u32::from(b'a'));

        // Act
        let result = item.matches(u32::from(b'b'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_fold_an_uppercase_byte_member() {
        // Arrange
        let item = BracketItem::Char(u32::from(b'A'));

        // Act
        let result = item.matches(u32::from(b'a'), true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_byte_inside_a_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'a'), u32::from(b'z'));

        // Act
        let result = item.matches(u32::from(b'm'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_byte_outside_a_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'a'), u32::from(b'y'));

        // Act
        let result = item.matches(u32::from(b'z'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_the_first_byte_of_a_backwards_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'z'), u32::from(b'a'));

        // Act
        let result = item.matches(u32::from(b'z'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_the_last_byte_of_a_backwards_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'z'), u32::from(b'a'));

        // Act
        let result = item.matches(u32::from(b'a'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_range_by_uppercase_when_folding_case() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'A'), u32::from(b'Z'));

        // Act
        let result = item.matches(u32::from(b'b'), true);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_range_by_uppercase_without_folding_case() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'A'), u32::from(b'Z'));

        // Act
        let result = item.matches(u32::from(b'b'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_the_first_byte_of_a_backwards_range_by_uppercase() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'Z'), u32::from(b'A'));

        // Act
        let result = item.matches(u32::from(b'z'), true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_byte_in_a_class() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Digit);

        // Act
        let result = item.matches(u32::from(b'5'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_class_by_uppercase_when_folding_case() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Upper);

        // Act
        let result = item.matches(u32::from(b'a'), true);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_class_by_uppercase_without_folding_case() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Upper);

        // Act
        let result = item.matches(u32::from(b'a'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_code_point_inside_a_range() {
        // Arrange
        let item = BracketItem::Range(u32::from('à'), u32::from('ÿ'));

        // Act
        let result = item.matches(u32::from('é'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_code_point_outside_ascii_with_a_class() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Alpha);

        // Act
        let result = item.matches(u32::from('é'), true);

        // Assert
        assert!(!result);
    }
}
