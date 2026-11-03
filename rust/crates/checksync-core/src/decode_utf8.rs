/// Decode a file's bytes as UTF-8 the way the original JavaScript does.
///
/// Node.js reads files through `readline`, which decodes them as UTF-8:
/// each maximal invalid subpart becomes one U+FFFD, the same as
/// [`String::from_utf8_lossy`], except that an incomplete sequence at the very
/// end of the input is dropped rather than replaced.
///
/// # Arguments
///
/// * `bytes` - The file's contents.
///
/// # Returns
///
/// The decoded text.
#[must_use]
pub fn decode_utf8(bytes: &[u8]) -> String {
    let mut text = String::with_capacity(bytes.len());
    let mut rest = bytes;
    loop {
        match std::str::from_utf8(rest) {
            Ok(valid) => {
                text.push_str(valid);
                return text;
            }
            Err(error) => {
                let (valid, after) = rest.split_at(error.valid_up_to());
                // `valid_up_to` marks the end of the valid prefix, so this
                // can't fail.
                text.push_str(std::str::from_utf8(valid).unwrap_or_default());
                match error.error_len() {
                    Some(len) => {
                        text.push(char::REPLACEMENT_CHARACTER);
                        rest = &after[len..];
                    }
                    // An incomplete sequence at the end of the input.
                    None => return text,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::decode_utf8;

    #[test]
    fn keeps_valid_utf8() {
        // Arrange
        let bytes = "a é 世 😀".as_bytes();

        // Act
        let result = decode_utf8(bytes);

        // Assert
        assert_eq!(result, "a é 世 😀");
    }

    #[test]
    fn replaces_an_invalid_byte() {
        // Arrange
        let bytes = b"a\xffb";

        // Act
        let result = decode_utf8(bytes);

        // Assert
        assert_eq!(result, "a\u{fffd}b");
    }

    #[test]
    fn replaces_each_maximal_invalid_subpart() {
        // Arrange
        let bytes = b"a\xed\xa0\x80b";

        // Act
        let result = decode_utf8(bytes);

        // Assert
        assert_eq!(result, "a\u{fffd}\u{fffd}\u{fffd}b");
    }

    #[test]
    fn replaces_an_incomplete_sequence_before_more_input() {
        // Arrange
        let bytes = b"a\xe2\x82\nb";

        // Act
        let result = decode_utf8(bytes);

        // Assert
        assert_eq!(result, "a\u{fffd}\nb");
    }

    #[test]
    fn drops_an_incomplete_sequence_at_the_end() {
        // Arrange
        let bytes = b"a\nb\xe2\x82";

        // Act
        let result = decode_utf8(bytes);

        // Assert
        assert_eq!(result, "a\nb");
    }

    #[test]
    fn replaces_a_lone_continuation_byte_at_the_end() {
        // Arrange
        let bytes = b"a\x82";

        // Act
        let result = decode_utf8(bytes);

        // Assert
        assert_eq!(result, "a\u{fffd}");
    }
}
