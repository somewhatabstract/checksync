/// Remove the trailing spaces from a `.gitignore` line, as git does.
///
/// Only spaces are removed, not tabs or other whitespace, and a space
/// escaped with a backslash is kept, along with any spaces before it.
///
/// # Arguments
///
/// * `line` - The line, without its line ending.
///
/// # Returns
///
/// The line without its trailing spaces.
#[must_use]
pub(crate) fn trim_gitignore_trailing_spaces(line: &[u8]) -> &[u8] {
    let mut first_trailing_space = None;
    let mut index = 0;
    while index < line.len() {
        match line[index] {
            b' ' => {
                first_trailing_space.get_or_insert(index);
            }
            b'\\' => {
                index += 1;
                if index == line.len() {
                    // A backslash at the very end keeps everything.
                    return line;
                }
                first_trailing_space = None;
            }
            _ => first_trailing_space = None,
        }
        index += 1;
    }
    &line[..first_trailing_space.unwrap_or(line.len())]
}

#[cfg(test)]
mod tests {
    use super::trim_gitignore_trailing_spaces;

    #[test]
    fn removes_trailing_spaces() {
        // Arrange
        let line = b"foo  ";

        // Act
        let result = trim_gitignore_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"foo");
    }

    #[test]
    fn keeps_spaces_inside_the_line() {
        // Arrange
        let line = b"a b";

        // Act
        let result = trim_gitignore_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"a b");
    }

    #[test]
    fn keeps_a_trailing_tab() {
        // Arrange
        let line = b"foo\t";

        // Act
        let result = trim_gitignore_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"foo\t");
    }

    #[test]
    fn keeps_an_escaped_space_and_removes_the_spaces_after_it() {
        // Arrange
        let line = b"foo\\  ";

        // Act
        let result = trim_gitignore_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"foo\\ ");
    }

    #[test]
    fn keeps_everything_after_a_final_backslash() {
        // Arrange
        let line = b"foo \\";

        // Act
        let result = trim_gitignore_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"foo \\");
    }
}
