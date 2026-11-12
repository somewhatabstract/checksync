/// Read one literal byte of a glob pattern, following a `\` escape.
///
/// A `\` makes the byte after it literal. A `\` with nothing after it can't
/// stand for any byte.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the byte, or the `\` escaping it, is in the pattern.
///   Must be within the pattern.
///
/// # Returns
///
/// The byte and the index just past it, or `None` if the pattern ends with
/// the `\`.
#[must_use]
pub(crate) fn read_glob_byte(pattern: &[u8], index: usize) -> Option<(u8, usize)> {
    if pattern[index] == b'\\' {
        pattern.get(index + 1).map(|&byte| (byte, index + 2))
    } else {
        Some((pattern[index], index + 1))
    }
}

#[cfg(test)]
mod tests {
    use super::read_glob_byte;

    #[test]
    fn reads_an_ordinary_byte() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = read_glob_byte(pattern, 1);

        // Assert
        assert_eq!(result, Some((b'b', 2)));
    }

    #[test]
    fn reads_the_byte_after_a_backslash() {
        // Arrange
        let pattern = b"\\*x";

        // Act
        let result = read_glob_byte(pattern, 0);

        // Assert
        assert_eq!(result, Some((b'*', 2)));
    }

    #[test]
    fn reads_nothing_from_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = read_glob_byte(pattern, 1);

        // Assert
        assert_eq!(result, None);
    }
}
