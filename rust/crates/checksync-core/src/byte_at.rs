/// Get the byte at an index, or NUL past the end.
///
/// This lets byte slices be read like C strings, as git's `wildmatch` reads
/// its pattern and text.
///
/// # Arguments
///
/// * `bytes` - The bytes to read.
/// * `index` - The index of the byte.
///
/// # Returns
///
/// The byte at `index`, or 0 if `index` is past the end.
#[must_use]
pub(crate) fn byte_at(bytes: &[u8], index: usize) -> u8 {
    bytes.get(index).copied().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::byte_at;

    #[test]
    fn returns_the_byte_at_the_index() {
        // Arrange
        let bytes = b"abc";

        // Act
        let result = byte_at(bytes, 1);

        // Assert
        assert_eq!(result, b'b');
    }

    #[test]
    fn returns_nul_past_the_end() {
        // Arrange
        let bytes = b"abc";

        // Act
        let result = byte_at(bytes, 3);

        // Assert
        assert_eq!(result, 0);
    }
}
