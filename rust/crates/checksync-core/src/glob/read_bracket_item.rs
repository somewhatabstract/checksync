use crate::glob::read_bracket_class::read_bracket_class;
use crate::glob::read_glob_byte::read_glob_byte;
use crate::glob::types::{BracketItem, ClassSyntax};

/// Read one member of a bracket set: a POSIX class, a range or a byte.
///
/// A `[:` starts a class only if `read_bracket_class` says so; otherwise its
/// `[` is an ordinary byte. A byte followed by `-` and then anything but
/// `]` starts a range, and either end of a range can be escaped with `\`. A
/// class can't start or end a range, so a `-` after a class is literal, and
/// a `[` after a `-` is just the end of the range.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the member starts in the pattern. Must be within the
///   pattern.
///
/// # Returns
///
/// The member and the index just past it, or `None` if the member is
/// malformed: an unknown class name, or a `\` at the end of the pattern.
#[must_use]
pub(super) fn read_bracket_item(pattern: &[u8], index: usize) -> Option<(BracketItem, usize)> {
    if pattern[index] == b'[' && pattern.get(index + 1) == Some(&b':') {
        match read_bracket_class(pattern, index) {
            ClassSyntax::Known(class, next) => return Some((BracketItem::Class(class), next)),
            ClassSyntax::Unknown => return None,
            ClassSyntax::NotAClass => {}
        }
    }
    let (start, next) = read_glob_byte(pattern, index)?;
    let starts_range =
        pattern.get(next) == Some(&b'-') && pattern.get(next + 1).is_some_and(|&byte| byte != b']');
    if !starts_range {
        return Some((BracketItem::Byte(start), next));
    }
    let (end, next) = read_glob_byte(pattern, next + 1)?;
    Some((BracketItem::Range(start, end), next))
}

#[cfg(test)]
mod tests {
    use super::read_bracket_item;
    use crate::glob::types::{BracketItem, PosixClass};

    #[test]
    fn reads_a_byte() {
        // Arrange
        let pattern = b"[ab]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Byte(b'a'), 2)));
    }

    #[test]
    fn reads_an_escaped_byte() {
        // Arrange
        let pattern = b"[\\]]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Byte(b']'), 3)));
    }

    #[test]
    fn reads_a_range() {
        // Arrange
        let pattern = b"[a-z]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Range(b'a', b'z'), 4)));
    }

    #[test]
    fn reads_a_range_with_escaped_ends() {
        // Arrange
        let pattern = b"[\\a-\\z]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Range(b'a', b'z'), 6)));
    }

    #[test]
    fn reads_a_dash_before_the_closing_bracket_as_a_separate_byte() {
        // Arrange
        let pattern = b"[a-]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Byte(b'a'), 2)));
    }

    #[test]
    fn reads_a_dash_at_the_end_of_the_pattern_as_a_separate_byte() {
        // Arrange
        let pattern = b"[a-";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Byte(b'a'), 2)));
    }

    #[test]
    fn reads_an_opening_bracket_as_the_end_of_a_range() {
        // Arrange
        let pattern = b"[a-[:upper:]]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Range(b'a', b'['), 4)));
    }

    #[test]
    fn reads_a_known_class() {
        // Arrange
        let pattern = b"[[:digit:]-z]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Class(PosixClass::Digit), 10)));
    }

    #[test]
    fn rejects_an_unknown_class() {
        // Arrange
        let pattern = b"[[:foo:]]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn reads_an_opening_bracket_that_does_not_start_a_class_as_a_byte() {
        // Arrange
        let pattern = b"[[:a]";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Byte(b'['), 2)));
    }

    #[test]
    fn reads_an_opening_bracket_at_the_end_of_the_pattern_as_a_byte() {
        // Arrange
        let pattern = b"[[";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, Some((BracketItem::Byte(b'['), 2)));
    }

    #[test]
    fn rejects_a_backslash_at_the_end_of_the_pattern() {
        // Arrange
        let pattern = b"[\\";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_range_ending_in_a_backslash_at_the_end_of_the_pattern() {
        // Arrange
        let pattern = b"[a-\\";

        // Act
        let result = read_bracket_item(pattern, 1);

        // Assert
        assert_eq!(result, None);
    }
}
