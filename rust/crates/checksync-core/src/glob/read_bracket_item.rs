use super::read_bracket_class::read_bracket_class;
use super::read_glob_char::read_glob_char;
use super::types::{BracketItem, ClassSyntax};

/// Read one member of a bracket set: a POSIX class, a range or a unit.
///
/// A unit is a byte, or with `unicode` a whole character, as
/// `read_glob_char` reads it. A `[:` starts a class only if
/// `read_bracket_class` says so; otherwise its `[` is an ordinary unit. A
/// unit followed by `-` and then anything but
/// `]` starts a range, and either end of a range can be escaped with `\`. A
/// class can't start or end a range, so a `-` after a class is literal, and
/// a `[` after a `-` is just the end of the range.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the member starts in the pattern. Must be within the
///   pattern.
/// * `unicode` - Whether units are characters rather than bytes.
///
/// # Returns
///
/// The member and the index just past it, or `None` if the member is
/// malformed: an unknown class name, or a `\` at the end of the pattern.
#[must_use]
pub(super) fn read_bracket_item(
    pattern: &[u8],
    index: usize,
    unicode: bool,
) -> Option<(BracketItem, usize)> {
    if pattern[index] == b'[' && pattern.get(index + 1) == Some(&b':') {
        match read_bracket_class(pattern, index) {
            ClassSyntax::Known(class, next) => return Some((BracketItem::Class(class), next)),
            ClassSyntax::Unknown => return None,
            ClassSyntax::NotAClass => {}
        }
    }
    let (start, unit) = read_glob_char(pattern, index, unicode)?;
    let next = unit.end;
    let starts_range =
        pattern.get(next) == Some(&b'-') && pattern.get(next + 1).is_some_and(|&byte| byte != b']');
    if !starts_range {
        return Some((BracketItem::Char(start), next));
    }
    let (end, unit) = read_glob_char(pattern, next + 1, unicode)?;
    Some((BracketItem::Range(start, end), unit.end))
}

#[cfg(test)]
mod tests {
    use super::super::types::{BracketItem, PosixClass};
    use super::read_bracket_item;

    #[test]
    fn reads_a_byte() {
        // Arrange
        let pattern = b"[ab]";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'a')), 2)));
    }

    #[test]
    fn reads_an_escaped_byte() {
        // Arrange
        let pattern = b"[\\]]";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b']')), 3)));
    }

    #[test]
    fn reads_a_range() {
        // Arrange
        let pattern = b"[a-z]";

        // Act
        let result = read_bracket_item(pattern, 1, false);

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
        let result = read_bracket_item(pattern, 1, false);

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
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'a')), 2)));
    }

    #[test]
    fn reads_a_dash_at_the_end_of_the_pattern_as_a_separate_byte() {
        // Arrange
        let pattern = b"[a-";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'a')), 2)));
    }

    #[test]
    fn reads_an_opening_bracket_as_the_end_of_a_range() {
        // Arrange
        let pattern = b"[a-[:upper:]]";

        // Act
        let result = read_bracket_item(pattern, 1, false);

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
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Class(PosixClass::Digit), 10)));
    }

    #[test]
    fn rejects_an_unknown_class() {
        // Arrange
        let pattern = b"[[:foo:]]";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn reads_an_opening_bracket_that_does_not_start_a_class_as_a_byte() {
        // Arrange
        let pattern = b"[[:a]";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'[')), 2)));
    }

    #[test]
    fn reads_an_opening_bracket_at_the_end_of_the_pattern_as_a_byte() {
        // Arrange
        let pattern = b"[[";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((BracketItem::Char(u32::from(b'[')), 2)));
    }

    #[test]
    fn rejects_a_backslash_at_the_end_of_the_pattern() {
        // Arrange
        let pattern = b"[\\";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_range_ending_in_a_backslash_at_the_end_of_the_pattern() {
        // Arrange
        let pattern = b"[a-\\";

        // Act
        let result = read_bracket_item(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn reads_a_range_of_characters_with_unicode() {
        // Arrange
        let pattern = "[à-ÿ]".as_bytes();

        // Act
        let result = read_bracket_item(pattern, 1, true);

        // Assert
        assert_eq!(
            result,
            Some((BracketItem::Range(u32::from('à'), u32::from('ÿ')), 6))
        );
    }
}
