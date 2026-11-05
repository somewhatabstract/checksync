use crate::parse_gitignore_pattern::parse_gitignore_pattern;
use crate::trim_gitignore_trailing_spaces::trim_gitignore_trailing_spaces;
use crate::types::GitignorePattern;

/// Read the patterns in a `.gitignore` file, as git does.
///
/// A UTF-8 byte order mark at the start is skipped. Lines end at `\n`, and a
/// `\r` just before it is dropped. An empty line, or one starting with `#`,
/// isn't a pattern. Trailing spaces are trimmed (see
/// [`trim_gitignore_trailing_spaces`]) and a NUL byte ends its line, as it
/// ends a C string in git, so a line can still leave an empty pattern, which
/// matches nothing.
///
/// # Arguments
///
/// * `contents` - The file's bytes.
///
/// # Returns
///
/// The file's patterns, in order.
#[must_use]
pub(crate) fn read_gitignore_patterns(contents: &[u8]) -> Vec<GitignorePattern> {
    let contents = contents.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(contents);
    // Text after the last `\n` is a line too; the empty text after a final
    // `\n` is dropped with the other empty lines.
    contents
        .split(|&byte| byte == b'\n')
        .filter(|line| !line.is_empty() && line[0] != b'#')
        .map(|line| {
            let line = line.strip_suffix(b"\r").unwrap_or(line);
            let line = line.split(|&byte| byte == 0).next().unwrap_or_default();
            parse_gitignore_pattern(trim_gitignore_trailing_spaces(line))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::read_gitignore_patterns;

    /// The patterns read from `contents`, as text.
    fn patterns(contents: &[u8]) -> Vec<String> {
        read_gitignore_patterns(contents)
            .into_iter()
            .map(|pattern| String::from_utf8(pattern.pattern).unwrap())
            .collect()
    }

    #[test]
    fn reads_one_pattern_per_line() {
        // Arrange
        let contents = b"a\nb\n";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a", "b"]);
    }

    #[test]
    fn reads_a_last_line_without_a_line_ending() {
        // Arrange
        let contents = b"a\nb";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a", "b"]);
    }

    #[test]
    fn drops_a_carriage_return_before_the_line_feed() {
        // Arrange
        let contents = b"a\r\nb\r\r\n";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a", "b\r"]);
    }

    #[test]
    fn skips_blank_lines_and_comments() {
        // Arrange
        let contents = b"\n#comment\na\n \\#b\n";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a", " \\#b"]);
    }

    #[test]
    fn skips_a_byte_order_mark() {
        // Arrange
        let contents = b"\xEF\xBB\xBFa\n";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a"]);
    }

    #[test]
    fn trims_trailing_spaces() {
        // Arrange
        let contents = b"a  \n";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a"]);
    }

    #[test]
    fn ends_a_line_at_a_nul_byte() {
        // Arrange
        let contents = b"a\0b\n";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, ["a"]);
    }

    #[test]
    fn reads_nothing_from_an_empty_file() {
        // Arrange
        let contents = b"";

        // Act
        let result = patterns(contents);

        // Assert
        assert_eq!(result, Vec::<String>::new());
    }
}
