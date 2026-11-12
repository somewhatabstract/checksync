use std::ops::Range;

use super::decode_glob_char::decode_glob_char;

/// Read one literal unit of a glob pattern, following a `\` escape.
///
/// A unit is a byte, or with `unicode` a whole character as
/// `decode_glob_char` reads it. A `\` makes the unit after it literal; a `\`
/// with nothing after it can't stand for anything.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the unit, or the `\` escaping it, is. Must be within
///   the pattern.
/// * `unicode` - Whether units are characters rather than bytes.
///
/// # Returns
///
/// The unit's code (the byte, or the character's code point) and where its
/// bytes lie in the pattern, not counting any `\`, or `None` if the pattern
/// ends with the `\`.
#[must_use]
pub(super) fn read_glob_char(
    pattern: &[u8],
    index: usize,
    unicode: bool,
) -> Option<(u32, Range<usize>)> {
    let start = if pattern[index] == b'\\' {
        index + 1
    } else {
        index
    };
    if start == pattern.len() {
        return None;
    }
    let (code, length) = if unicode {
        decode_glob_char(pattern, start)
    } else {
        (u32::from(pattern[start]), 1)
    };
    Some((code, start..start + length))
}

#[cfg(test)]
mod tests {
    use super::read_glob_char;

    #[test]
    fn reads_an_ordinary_byte() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = read_glob_char(pattern, 1, false);

        // Assert
        assert_eq!(result, Some((u32::from(b'b'), 1..2)));
    }

    #[test]
    fn reads_the_byte_after_a_backslash() {
        // Arrange
        let pattern = b"\\*x";

        // Act
        let result = read_glob_char(pattern, 0, false);

        // Assert
        assert_eq!(result, Some((u32::from(b'*'), 1..2)));
    }

    #[test]
    fn reads_one_byte_of_a_character_without_unicode() {
        // Arrange
        let pattern = "é".as_bytes();

        // Act
        let result = read_glob_char(pattern, 0, false);

        // Assert
        assert_eq!(result, Some((0xC3, 0..1)));
    }

    #[test]
    fn reads_a_whole_character_with_unicode() {
        // Arrange
        let pattern = "é".as_bytes();

        // Act
        let result = read_glob_char(pattern, 0, true);

        // Assert
        assert_eq!(result, Some((u32::from('é'), 0..2)));
    }

    #[test]
    fn reads_an_escaped_character_with_unicode() {
        // Arrange
        let pattern = "\\中".as_bytes();

        // Act
        let result = read_glob_char(pattern, 0, true);

        // Assert
        assert_eq!(result, Some((u32::from('中'), 1..4)));
    }

    #[test]
    fn reads_nothing_from_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = read_glob_char(pattern, 1, false);

        // Assert
        assert_eq!(result, None);
    }
}
