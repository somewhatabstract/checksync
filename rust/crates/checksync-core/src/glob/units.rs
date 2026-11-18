//! Reading the units of a pattern or text: bytes, or whole UTF-8 characters.

use std::ops::Range;

/// The code given to a byte that isn't part of valid UTF-8, plus the byte.
///
/// It lies beyond every Unicode code point, so such a byte never equals a real
/// character, but it still has a well-defined place in ranges.
const INVALID_BYTE_BASE: u32 = 0x11_0000;

/// Returns the code and byte length of the character at `index`, for unicode matching.
///
/// `index` must be within `bytes`, which is a pattern or text. A valid UTF-8
/// character of 1 to 4 bytes gives its code point. A byte that doesn't start a
/// valid character counts as one character on its own, with a code beyond every
/// Unicode code point, [`INVALID_BYTE_BASE`] plus the byte.
#[must_use]
pub(super) fn decode_glob_char(bytes: &[u8], index: usize) -> (u32, usize) {
    let window = &bytes[index..bytes.len().min(index + 4)];
    let first = window
        .utf8_chunks()
        .next()
        .and_then(|chunk| chunk.valid().chars().next());
    match first {
        Some(character) => (u32::from(character), character.len_utf8()),
        None => (INVALID_BYTE_BASE + u32::from(bytes[index]), 1),
    }
}

/// Reads one literal unit of a glob pattern, following a `\` escape.
///
/// `index`, where the unit or the `\` escaping it is, must be within `pattern`. A
/// unit is a byte, or with `unicode` a whole character as [`decode_glob_char`]
/// reads it. Returns the unit's code (the byte, or the character's code point)
/// and where its bytes lie in the pattern, not counting any `\`, or `None` if the
/// pattern ends with the `\`, which can't stand for anything.
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

/// Returns the bytes before the first NUL, as a C string would end there.
///
/// Bytes with no NUL are returned whole.
#[must_use]
pub(super) fn bytes_before_nul(bytes: &[u8]) -> &[u8] {
    bytes
        .iter()
        .position(|&byte| byte == 0)
        .map_or(bytes, |end| &bytes[..end])
}

#[cfg(test)]
mod tests {
    use super::{INVALID_BYTE_BASE, bytes_before_nul, decode_glob_char, read_glob_char};

    #[test]
    fn reads_an_ascii_character() {
        // Arrange
        let bytes = b"ab";

        // Act
        let result = decode_glob_char(bytes, 1);

        // Assert
        assert_eq!(result, (u32::from('b'), 1));
    }

    #[test]
    fn reads_a_two_byte_character() {
        // Arrange
        let bytes = "xé".as_bytes();

        // Act
        let result = decode_glob_char(bytes, 1);

        // Assert
        assert_eq!(result, (u32::from('é'), 2));
    }

    #[test]
    fn reads_a_three_byte_character() {
        // Arrange
        let bytes = "中".as_bytes();

        // Act
        let result = decode_glob_char(bytes, 0);

        // Assert
        assert_eq!(result, (u32::from('中'), 3));
    }

    #[test]
    fn reads_a_four_byte_character() {
        // Arrange
        let bytes = "😀a".as_bytes();

        // Act
        let result = decode_glob_char(bytes, 0);

        // Assert
        assert_eq!(result, (u32::from('😀'), 4));
    }

    #[test]
    fn reads_an_invalid_byte_as_one_character() {
        // Arrange
        let bytes = b"\xE9a";

        // Act
        let result = decode_glob_char(bytes, 0);

        // Assert
        assert_eq!(result, (INVALID_BYTE_BASE + 0xE9, 1));
    }

    #[test]
    fn reads_a_truncated_character_one_byte_at_a_time() {
        // Arrange
        let bytes = b"\xE4\xB8";

        // Act
        let result = decode_glob_char(bytes, 0);

        // Assert
        assert_eq!(result, (INVALID_BYTE_BASE + 0xE4, 1));
    }

    #[test]
    fn reads_a_stray_continuation_byte_as_one_character() {
        // Arrange
        let bytes = "é".as_bytes();

        // Act
        let result = decode_glob_char(bytes, 1);

        // Assert
        assert_eq!(result, (INVALID_BYTE_BASE + 0xA9, 1));
    }

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

    #[test]
    fn cuts_at_the_first_nul() {
        // Arrange
        let bytes = b"ab\0c\0d";

        // Act
        let result = bytes_before_nul(bytes);

        // Assert
        assert_eq!(result, b"ab");
    }

    #[test]
    fn keeps_bytes_without_a_nul() {
        // Arrange
        let bytes = b"abc";

        // Act
        let result = bytes_before_nul(bytes);

        // Assert
        assert_eq!(result, b"abc");
    }
}
