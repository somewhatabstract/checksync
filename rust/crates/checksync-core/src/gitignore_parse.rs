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
    use crate::compile_glob::compile_glob;
    use crate::gitignore_parse_line::GITIGNORE_GLOB_OPTIONS;
    use crate::types::CompiledGlob;

    /// List the globs of the patterns read from `contents`.
    fn globs(contents: &[u8]) -> Vec<CompiledGlob> {
        gitignore_parse(contents)
            .into_iter()
            .map(|pattern| pattern.glob)
            .collect()
    }

    /// Compile each of `patterns` as an ignore file would.
    fn compiled(patterns: &[&[u8]]) -> Vec<CompiledGlob> {
        patterns
            .iter()
            .map(|pattern| compile_glob(pattern, GITIGNORE_GLOB_OPTIONS).unwrap())
            .collect()
    }

    #[test]
    fn reads_each_line_in_order() {
        // Arrange
        let contents = b"a\n\n# c\nb";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"a", b"b"]));
    }

    #[test]
    fn skips_a_byte_order_mark_at_the_start() {
        // Arrange
        let contents = b"\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"a"]));
    }

    #[test]
    fn keeps_a_second_byte_order_mark() {
        // Arrange
        let contents = b"\xEF\xBB\xBF\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"\xEF\xBB\xBFa"]));
    }

    #[test]
    fn keeps_a_byte_order_mark_after_the_first_line() {
        // Arrange
        let contents = b"x\n\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"x", b"\xEF\xBB\xBFa"]));
    }
}
