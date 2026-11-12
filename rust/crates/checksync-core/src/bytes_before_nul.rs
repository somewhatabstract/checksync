/// Cut bytes off at the first NUL, as a C string would end there.
///
/// # Arguments
///
/// * `bytes` - The bytes to cut.
///
/// # Returns
///
/// The bytes before the first NUL, or all of them if there is none.
#[must_use]
pub(crate) fn bytes_before_nul(bytes: &[u8]) -> &[u8] {
    bytes
        .iter()
        .position(|&byte| byte == 0)
        .map_or(bytes, |end| &bytes[..end])
}

#[cfg(test)]
mod tests {
    use super::bytes_before_nul;

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
