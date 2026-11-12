/// Check whether a position in a text is a `.` that starts a name.
///
/// A name starts at the beginning of the text or just after a `/`.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `position` - The position to check, which may be the text's length.
///
/// # Returns
///
/// `true` if the byte at the position is a `.` starting a name.
#[must_use]
pub(super) fn starts_hidden_name(text: &[u8], position: usize) -> bool {
    text.get(position) == Some(&b'.') && (position == 0 || text[position - 1] == b'/')
}

#[cfg(test)]
mod tests {
    use super::starts_hidden_name;

    #[test]
    fn finds_a_dot_at_the_start_of_the_text() {
        // Arrange
        let text = b".a";

        // Act
        let result = starts_hidden_name(text, 0);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_dot_after_a_slash() {
        // Arrange
        let text = b"a/.b";

        // Act
        let result = starts_hidden_name(text, 2);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_dot_inside_a_name() {
        // Arrange
        let text = b"a.b";

        // Act
        let result = starts_hidden_name(text, 1);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_another_byte_starting_a_name() {
        // Arrange
        let text = b"a/b";

        // Act
        let result = starts_hidden_name(text, 2);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_the_end_of_the_text() {
        // Arrange
        let text = b"a/";

        // Act
        let result = starts_hidden_name(text, 2);

        // Assert
        assert!(!result);
    }
}
