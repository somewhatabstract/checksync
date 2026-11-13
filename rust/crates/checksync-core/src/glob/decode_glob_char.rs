/// The code given to a byte that isn't part of valid UTF-8, plus the byte.
///
/// It lies beyond every Unicode code point, so such a byte never equals a
/// real character, but it still has a well-defined place in ranges.
const INVALID_BYTE_BASE: u32 = 0x11_0000;

/// Read the character that starts at a position, for unicode matching.
///
/// A valid UTF-8 character of 1 to 4 bytes gives its code point. A byte
/// that doesn't start a valid character counts as one character on its own,
/// with a code beyond every Unicode code point.
///
/// # Arguments
///
/// * `bytes` - The pattern or text.
/// * `index` - Where the character starts. Must be within `bytes`.
///
/// # Returns
///
/// The character's code and its length in bytes.
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

#[cfg(test)]
mod tests {
    use super::{INVALID_BYTE_BASE, decode_glob_char};

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
}
