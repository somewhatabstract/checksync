use crate::gitignore::trim_trailing_spaces::trim_trailing_spaces;
use crate::gitignore::types::GitignorePattern;
use crate::glob::{GlobOptions, bytes_before_nul, compile_glob};

/// The options every ignore-file glob is matched with: `/` separates
/// folders, and ASCII case is always ignored.
pub(super) const GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: true,
};

/// Read one line of a `.gitignore`-style file as a pattern.
///
/// One `\r` directly before the line feed is dropped, and then a NUL byte
/// ends the line, so a `\r` just before a NUL is kept. A line starting
/// with `#` is a comment, and trailing unescaped spaces are dropped. A
/// leading `!` negates the pattern and one trailing `/` limits it
/// to folders. A `/` anywhere else anchors the pattern to the ignore file's
/// folder, and a leading `/` is then dropped.
///
/// # Arguments
///
/// * `line` - The line, without its line feed.
///
/// # Returns
///
/// The pattern, or `None` if the line is a comment, holds no pattern, or
/// holds one that can never match anything, which has no effect.
#[must_use]
pub(super) fn parse_line(line: &[u8]) -> Option<GitignorePattern> {
    let line = bytes_before_nul(line.strip_suffix(b"\r").unwrap_or(line));
    if line.first() == Some(&b'#') {
        return None;
    }
    let line = trim_trailing_spaces(line);
    let negated = line.first() == Some(&b'!');
    let line = if negated { &line[1..] } else { line };
    let folders_only = line.last() == Some(&b'/');
    let line = if folders_only {
        &line[..line.len() - 1]
    } else {
        line
    };
    if line.is_empty() {
        return None;
    }
    let anchored = line.contains(&b'/');
    let glob = line.strip_prefix(b"/").unwrap_or(line);
    Some(GitignorePattern {
        glob: compile_glob(glob, GLOB_OPTIONS)?,
        negated,
        folders_only,
        anchored,
    })
}

#[cfg(test)]
mod tests {
    use super::{GLOB_OPTIONS, parse_line};
    use crate::gitignore::types::GitignorePattern;
    use crate::glob::compile_glob;

    fn pattern(glob: &[u8], negated: bool, folders_only: bool, anchored: bool) -> GitignorePattern {
        GitignorePattern {
            glob: compile_glob(glob, GLOB_OPTIONS).unwrap(),
            negated,
            folders_only,
            anchored,
        }
    }

    #[test]
    fn reads_a_name_pattern() {
        // Arrange
        let line = b"*.log";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"*.log", false, false, false)));
    }

    #[test]
    fn skips_a_blank_line() {
        // Arrange
        let line = b"";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn skips_a_line_of_spaces() {
        // Arrange
        let line = b"   ";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn skips_a_comment() {
        // Arrange
        let line = b"# *.js";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn keeps_an_escaped_hash() {
        // Arrange
        let line = b"\\#a";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"\\#a", false, false, false)));
    }

    #[test]
    fn reads_a_hash_after_leading_spaces_as_part_of_the_pattern() {
        // Arrange
        let line = b" #a";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b" #a", false, false, false)));
    }

    #[test]
    fn drops_trailing_spaces() {
        // Arrange
        let line = b"a  ";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn drops_one_carriage_return() {
        // Arrange
        let line = b"a\r\r";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a\r", false, false, false)));
    }

    #[test]
    fn drops_spaces_before_a_carriage_return() {
        // Arrange
        let line = b"a \r";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn ends_the_line_at_a_nul_byte() {
        // Arrange
        let line = b"a \0/b";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn drops_a_carriage_return_after_a_nul_byte() {
        // Arrange
        let line = b"a\0x\r";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn keeps_a_carriage_return_before_a_nul_byte() {
        // Arrange
        let line = b"a\r\0x";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a\r", false, false, false)));
    }

    #[test]
    fn negates_a_pattern_starting_with_an_exclamation_mark() {
        // Arrange
        let line = b"!a";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", true, false, false)));
    }

    #[test]
    fn keeps_an_escaped_exclamation_mark() {
        // Arrange
        let line = b"\\!a";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"\\!a", false, false, false)));
    }

    #[test]
    fn skips_a_lone_exclamation_mark() {
        // Arrange
        let line = b"!";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn limits_a_pattern_with_a_trailing_slash_to_folders() {
        // Arrange
        let line = b"build/";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"build", false, true, false)));
    }

    #[test]
    fn skips_a_lone_slash() {
        // Arrange
        let line = b"/";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn skips_a_pattern_that_can_never_match() {
        // Arrange
        let line = b"foo[ab";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn anchors_and_drops_a_leading_slash() {
        // Arrange
        let line = b"/build";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"build", false, false, true)));
    }

    #[test]
    fn anchors_a_leading_slash_before_a_double_star() {
        // Arrange
        let line = b"/**b";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"**b", false, false, true)));
    }

    #[test]
    fn anchors_a_pattern_with_a_middle_slash() {
        // Arrange
        let line = b"doc/frotz/";

        // Act
        let result = parse_line(line);

        // Assert
        assert_eq!(result, Some(pattern(b"doc/frotz", false, true, true)));
    }
}
