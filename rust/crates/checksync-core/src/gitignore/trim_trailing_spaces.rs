/// Drop the unescaped spaces from the end of a line of an ignore file.
///
/// A space escaped with `\` is kept, along with everything before it. Only
/// spaces are dropped, not tabs.
///
/// # Arguments
///
/// * `line` - The line, without its line ending.
///
/// # Returns
///
/// The line without its trailing unescaped spaces.
#[must_use]
pub(super) fn trim_trailing_spaces(line: &[u8]) -> &[u8] {
    let mut kept = 0;
    let mut index = 0;
    while index < line.len() {
        match line[index] {
            b'\\' if index + 1 < line.len() => index += 2,
            b' ' => {
                index += 1;
                continue;
            }
            _ => index += 1,
        }
        kept = index;
    }
    &line[..kept]
}

#[cfg(test)]
mod tests {
    use super::trim_trailing_spaces;

    #[test]
    fn drops_trailing_spaces() {
        // Arrange
        let line = b"a.js   ";

        // Act
        let result = trim_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"a.js");
    }

    #[test]
    fn keeps_spaces_before_other_bytes() {
        // Arrange
        let line = b" a b";

        // Act
        let result = trim_trailing_spaces(line);

        // Assert
        assert_eq!(result, b" a b");
    }

    #[test]
    fn keeps_an_escaped_trailing_space() {
        // Arrange
        let line = b"a\\  ";

        // Act
        let result = trim_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"a\\ ");
    }

    #[test]
    fn drops_spaces_after_an_escaped_backslash() {
        // Arrange
        let line = b"a\\\\  ";

        // Act
        let result = trim_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"a\\\\");
    }

    #[test]
    fn keeps_trailing_tabs() {
        // Arrange
        let line = b"a\t";

        // Act
        let result = trim_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"a\t");
    }

    #[test]
    fn keeps_a_backslash_at_the_end() {
        // Arrange
        let line = b"a\\";

        // Act
        let result = trim_trailing_spaces(line);

        // Assert
        assert_eq!(result, b"a\\");
    }
}
