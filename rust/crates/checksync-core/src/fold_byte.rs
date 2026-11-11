/// Lowercase an ASCII letter when ignoring case.
///
/// # Arguments
///
/// * `byte` - The byte to fold.
/// * `casefold` - Whether to ignore case.
///
/// # Returns
///
/// The byte, lowercased if it's an ASCII letter and `casefold` is set.
#[must_use]
pub(crate) fn fold_byte(byte: u8, casefold: bool) -> u8 {
    if casefold {
        byte.to_ascii_lowercase()
    } else {
        byte
    }
}

#[cfg(test)]
mod tests {
    use super::fold_byte;

    #[test]
    fn lowercases_an_ascii_letter_when_ignoring_case() {
        // Arrange
        let byte = b'A';

        // Act
        let result = fold_byte(byte, true);

        // Assert
        assert_eq!(result, b'a');
    }

    #[test]
    fn keeps_the_case_when_not_ignoring_case() {
        // Arrange
        let byte = b'A';

        // Act
        let result = fold_byte(byte, false);

        // Assert
        assert_eq!(result, b'A');
    }

    #[test]
    fn leaves_a_non_ascii_byte_alone() {
        // Arrange
        let byte = 0xC9;

        // Act
        let result = fold_byte(byte, true);

        // Assert
        assert_eq!(result, 0xC9);
    }
}
