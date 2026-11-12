/// Check whether a position in a text is inside a name that is `.` or `..`.
///
/// A name starts at the beginning of the text or just after a `/`, and ends
/// at the next `/` or the end of the text.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `position` - The position to check, which may be the text's length.
///
/// # Returns
///
/// `true` if the byte at the position is a `.` of a name that is exactly
/// `.` or `..`.
#[must_use]
pub(super) fn in_dot_segment(text: &[u8], position: usize) -> bool {
    if text.get(position) != Some(&b'.') {
        return false;
    }
    let start = if position > 0 && text[position - 1] == b'.' {
        position - 1
    } else {
        position
    };
    let starts_name = start == 0 || text[start - 1] == b'/';
    let end = if text.get(start + 1) == Some(&b'.') {
        start + 2
    } else {
        start + 1
    };
    starts_name && matches!(text.get(end), None | Some(b'/'))
}

#[cfg(test)]
mod tests {
    use super::in_dot_segment;

    #[test]
    fn finds_a_dot_name() {
        // Arrange
        let text = b"a/./b";

        // Act
        let result = in_dot_segment(text, 2);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_both_dots_of_a_dot_dot_name() {
        // Arrange
        let text = b"../a";

        // Act
        let result = (in_dot_segment(text, 0), in_dot_segment(text, 1));

        // Assert
        assert_eq!(result, (true, true));
    }

    #[test]
    fn finds_a_dot_dot_name_at_the_end() {
        // Arrange
        let text = b"a/..";

        // Act
        let result = in_dot_segment(text, 3);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_hidden_name() {
        // Arrange
        let text = b".a";

        // Act
        let result = in_dot_segment(text, 0);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_three_dots() {
        // Arrange
        let text = b"...";

        // Act
        let result = (
            in_dot_segment(text, 0),
            in_dot_segment(text, 1),
            in_dot_segment(text, 2),
        );

        // Assert
        assert_eq!(result, (false, false, false));
    }

    #[test]
    fn ignores_dots_ending_a_name() {
        // Arrange
        let text = b"a..";

        // Act
        let result = (in_dot_segment(text, 1), in_dot_segment(text, 2));

        // Assert
        assert_eq!(result, (false, false));
    }

    #[test]
    fn ignores_another_byte() {
        // Arrange
        let text = b"a";

        // Act
        let result = in_dot_segment(text, 0);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_the_end_of_the_text() {
        // Arrange
        let text = b"..";

        // Act
        let result = in_dot_segment(text, 2);

        // Assert
        assert!(!result);
    }
}
