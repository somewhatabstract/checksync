//! Ignore-file patterns: the glob options they use and reading them from lines.

mod matches;

use crate::glob::{CompiledGlob, GlobOptions, HiddenNames};

/// One pattern read from a `.gitignore`-style file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GitignorePattern {
    /// The compiled glob to match.
    ///
    /// It's compiled from the pattern without any leading `!`, leading `/` or
    /// trailing `/`.
    pub(super) glob: CompiledGlob,
    /// Whether the pattern started with `!`, so a match unignores.
    pub(super) negated: bool,
    /// Whether the pattern ended with `/`, so it matches only folders.
    pub(super) folders_only: bool,
    /// Whether the pattern is anchored to the ignore file's folder.
    ///
    /// It is when it held a `/` before any trailing one, and it then matches the whole
    /// path from the folder rather than just the last name in it.
    pub(super) anchored: bool,
}

impl GitignorePattern {
    /// Reads one line of a `.gitignore`-style file, without its line feed, as a pattern.
    ///
    /// One `\r` directly before the line feed is dropped, and then a NUL byte ends
    /// the line, so a `\r` just before a NUL is kept. A line starting with `#` is a
    /// comment, and trailing unescaped spaces are dropped. A leading `!` negates the
    /// pattern and one trailing `/` limits it to folders. A `/` anywhere else anchors
    /// the pattern to the ignore file's folder, and a leading `/` is then dropped.
    ///
    /// Returns `None` if the line is a comment, holds no pattern, or holds one that
    /// can never match anything, which has no effect.
    #[must_use]
    pub(super) fn parse(line: &[u8]) -> Option<Self> {
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
            glob: CompiledGlob::try_new(glob, GLOB_OPTIONS)?,
            negated,
            folders_only,
            anchored,
        })
    }
}

/// The options every ignore-file glob is matched with.
///
/// `/` separates folders, ASCII case is always ignored, and wildcards match names
/// starting with `.`, as in git.
pub(super) const GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: true,
    hidden: HiddenNames::MatchAll,
    unicode: false,
};

/// Returns a line of an ignore file without its trailing unescaped spaces.
///
/// The line has no line ending. A space escaped with `\` is kept, along with
/// everything before it. Only spaces are dropped, not tabs.
#[must_use]
fn trim_trailing_spaces(line: &[u8]) -> &[u8] {
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

/// Returns the bytes before the first NUL, as a C string would end there.
///
/// Bytes with no NUL are returned whole.
#[must_use]
fn bytes_before_nul(bytes: &[u8]) -> &[u8] {
    bytes
        .iter()
        .position(|&byte| byte == 0)
        .map_or(bytes, |end| &bytes[..end])
}

#[cfg(test)]
mod tests {
    use super::{GLOB_OPTIONS, GitignorePattern, bytes_before_nul, trim_trailing_spaces};
    use crate::glob::CompiledGlob;

    fn pattern(glob: &[u8], negated: bool, folders_only: bool, anchored: bool) -> GitignorePattern {
        GitignorePattern {
            glob: CompiledGlob::try_new(glob, GLOB_OPTIONS).unwrap(),
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
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"*.log", false, false, false)));
    }

    #[test]
    fn skips_a_blank_line() {
        // Arrange
        let line = b"";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn skips_a_line_of_spaces() {
        // Arrange
        let line = b"   ";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn skips_a_comment() {
        // Arrange
        let line = b"# *.js";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn keeps_an_escaped_hash() {
        // Arrange
        let line = b"\\#a";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"\\#a", false, false, false)));
    }

    #[test]
    fn reads_a_hash_after_leading_spaces_as_part_of_the_pattern() {
        // Arrange
        let line = b" #a";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b" #a", false, false, false)));
    }

    #[test]
    fn parse_drops_trailing_spaces() {
        // Arrange
        let line = b"a  ";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn drops_one_carriage_return() {
        // Arrange
        let line = b"a\r\r";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a\r", false, false, false)));
    }

    #[test]
    fn drops_spaces_before_a_carriage_return() {
        // Arrange
        let line = b"a \r";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn ends_the_line_at_a_nul_byte() {
        // Arrange
        let line = b"a \0/b";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn drops_a_carriage_return_after_a_nul_byte() {
        // Arrange
        let line = b"a\0x\r";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", false, false, false)));
    }

    #[test]
    fn keeps_a_carriage_return_before_a_nul_byte() {
        // Arrange
        let line = b"a\r\0x";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a\r", false, false, false)));
    }

    #[test]
    fn negates_a_pattern_starting_with_an_exclamation_mark() {
        // Arrange
        let line = b"!a";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"a", true, false, false)));
    }

    #[test]
    fn keeps_an_escaped_exclamation_mark() {
        // Arrange
        let line = b"\\!a";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"\\!a", false, false, false)));
    }

    #[test]
    fn skips_a_lone_exclamation_mark() {
        // Arrange
        let line = b"!";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn limits_a_pattern_with_a_trailing_slash_to_folders() {
        // Arrange
        let line = b"build/";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"build", false, true, false)));
    }

    #[test]
    fn skips_a_lone_slash() {
        // Arrange
        let line = b"/";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn skips_a_pattern_that_can_never_match() {
        // Arrange
        let line = b"foo[ab";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn anchors_and_drops_a_leading_slash() {
        // Arrange
        let line = b"/build";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"build", false, false, true)));
    }

    #[test]
    fn anchors_a_leading_slash_before_a_double_star() {
        // Arrange
        let line = b"/**b";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"**b", false, false, true)));
    }

    #[test]
    fn anchors_a_pattern_with_a_middle_slash() {
        // Arrange
        let line = b"doc/frotz/";

        // Act
        let result = GitignorePattern::parse(line);

        // Assert
        assert_eq!(result, Some(pattern(b"doc/frotz", false, true, true)));
    }

    #[test]
    fn cuts_at_the_first_nul() {
        // Arrange
        let bytes = b"ab\0c\0d";

        // Act
        let result = bytes_before_nul(bytes);

        // Assert
        assert_eq!(result, b"ab");
    }

    #[test]
    fn keeps_bytes_without_a_nul() {
        // Arrange
        let bytes = b"abc";

        // Act
        let result = bytes_before_nul(bytes);

        // Assert
        assert_eq!(result, b"abc");
    }

    #[test]
    fn trim_drops_trailing_spaces() {
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
