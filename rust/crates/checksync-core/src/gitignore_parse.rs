use crate::gitignore_parse_line::gitignore_parse_line;
use crate::types::GitignorePattern;

/// Read the patterns from the contents of a `.gitignore`-style file.
///
/// A UTF-8 byte order mark at the very start is skipped, and lines end at
/// each line feed.
///
/// # Arguments
///
/// * `contents` - The raw bytes of the file.
///
/// # Returns
///
/// The patterns, in the order they appear.
#[must_use]
pub(crate) fn gitignore_parse(contents: &[u8]) -> Vec<GitignorePattern> {
    let contents = contents.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(contents);
    contents
        .split(|&byte| byte == b'\n')
        .filter_map(gitignore_parse_line)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::gitignore_parse;

    /// List the globs of the patterns read from `contents`.
    fn globs(contents: &[u8]) -> Vec<Vec<u8>> {
        gitignore_parse(contents)
            .into_iter()
            .map(|pattern| pattern.glob)
            .collect()
    }

    #[test]
    fn reads_each_line_in_order() {
        // Arrange
        let contents = b"a\n\n# c\nb";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, vec![b"a".to_vec(), b"b".to_vec()]);
    }

    #[test]
    fn skips_a_byte_order_mark_at_the_start() {
        // Arrange
        let contents = b"\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, vec![b"a".to_vec()]);
    }

    #[test]
    fn keeps_a_second_byte_order_mark() {
        // Arrange
        let contents = b"\xEF\xBB\xBF\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, vec![b"\xEF\xBB\xBFa".to_vec()]);
    }

    #[test]
    fn keeps_a_byte_order_mark_after_the_first_line() {
        // Arrange
        let contents = b"x\n\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, vec![b"x".to_vec(), b"\xEF\xBB\xBFa".to_vec()]);
    }
}
