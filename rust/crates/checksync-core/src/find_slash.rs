/// Find the first `/` in some text from an index on, before any NUL.
///
/// # Arguments
///
/// * `text` - The text to search.
/// * `index` - Where to start searching; at most the length of `text`.
///
/// # Returns
///
/// The index of the first `/` at or after `index`, or `None` if a NUL or the
/// end comes first.
#[must_use]
pub(crate) fn find_slash(text: &[u8], index: usize) -> Option<usize> {
    text[index..]
        .iter()
        .take_while(|&&byte| byte != 0)
        .position(|&byte| byte == b'/')
        .map(|offset| index + offset)
}

#[cfg(test)]
mod tests {
    use super::find_slash;

    #[test]
    fn finds_the_first_slash_from_the_index() {
        // Arrange
        let text = b"a/b/c";

        // Act
        let result = find_slash(text, 2);

        // Assert
        assert_eq!(result, Some(3));
    }

    #[test]
    fn finds_a_slash_at_the_index() {
        // Arrange
        let text = b"a/b";

        // Act
        let result = find_slash(text, 1);

        // Assert
        assert_eq!(result, Some(1));
    }

    #[test]
    fn finds_nothing_without_a_slash() {
        // Arrange
        let text = b"abc";

        // Act
        let result = find_slash(text, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn stops_at_a_nul() {
        // Arrange
        let text = b"a\0/b";

        // Act
        let result = find_slash(text, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_nothing_from_the_end() {
        // Arrange
        let text = b"a/";

        // Act
        let result = find_slash(text, 2);

        // Assert
        assert_eq!(result, None);
    }
}
