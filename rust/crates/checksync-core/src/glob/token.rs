//! Glob tokens: splitting a pattern into them, and moving the reachable text
//! positions past them.

mod advance;
mod wildcards;

use super::bracket_set::BracketSet;
use super::compiled_glob::GlobOptions;
use super::unit_matcher::UnitMatcher;
use super::units::read_glob_char;

/// One step of a parsed glob pattern.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum GlobToken {
    /// Exactly one unit of the text: a byte, or a character in unicode mode.
    One(UnitMatcher),
    /// Any run of bytes, including none.
    Star {
        /// Whether the run may include `/`.
        crosses_slash: bool,
    },
    /// Any number of whole folders, including none.
    ///
    /// That's either nothing, or any run of bytes that ends with `/`.
    AnyFolders,
}

/// Splits a glob pattern into the tokens that each match part of the text.
///
/// The pattern has no NUL byte. `options` says how to treat slashes, which
/// decides what `**` means, and whether literals and bracket sets work on
/// characters or bytes. Returns the tokens, in order, or `None` if the pattern
/// can never match anything: it ends with a `\`, or has a malformed bracket set.
#[must_use]
pub(super) fn tokenize_glob(pattern: &[u8], options: GlobOptions) -> Option<Vec<GlobToken>> {
    let mut tokens = Vec::new();
    let mut index = 0;
    while index < pattern.len() {
        let (token, next) = match pattern[index] {
            b'?' => (GlobToken::One(UnitMatcher::Any), index + 1),
            b'*' => read_star_run(pattern, index, options),
            b'[' => {
                let (set, next) = BracketSet::parse(pattern, index, options.unicode)?;
                (GlobToken::One(UnitMatcher::Set(set)), next)
            }
            first => {
                let (_, unit) = read_glob_char(pattern, index, options.unicode)?;
                let matcher = match &pattern[unit.clone()] {
                    [byte] if first == b'\\' => UnitMatcher::Escaped(*byte),
                    [byte] => UnitMatcher::Literal(*byte),
                    bytes => UnitMatcher::Character(bytes.to_vec()),
                };
                (GlobToken::One(matcher), unit.end)
            }
        };
        tokens.push(token);
        index = next;
    }
    Some(tokens)
}

/// Reads the run of `*` at `index` in a glob pattern and works out what it matches.
///
/// Without `options.pathname`, any run matches any bytes. With it, a run of two
/// or more that starts the pattern or follows a `/` (escaped or not) can be
/// special, depending on what comes after it:
///
/// * a `/`: the run takes that `/` with it and matches any number of whole
///   folders;
/// * the end of the pattern, or an escaped `/`: the run matches any bytes, and an
///   escaped `/` is left to match a `/` of its own;
/// * anything else: the run acts like a single `*`.
///
/// Any other run acts like a single `*`, which doesn't match `/`. Returns the
/// token the run stands for and the index just past what it used up.
#[must_use]
fn read_star_run(pattern: &[u8], index: usize, options: GlobOptions) -> (GlobToken, usize) {
    let length = pattern[index..]
        .iter()
        .take_while(|&&byte| byte == b'*')
        .count();
    let end = index + length;
    let rest = &pattern[end..];
    let starts_folder = index == 0 || pattern[index - 1] == b'/';
    let can_be_special = options.pathname && length >= 2 && starts_folder;
    if can_be_special && rest.first() == Some(&b'/') {
        return (GlobToken::AnyFolders, end + 1);
    }
    let crosses_slash =
        !options.pathname || (can_be_special && (rest.is_empty() || rest.starts_with(b"\\/")));
    (GlobToken::Star { crosses_slash }, end)
}

#[cfg(test)]
mod tests {
    use super::super::bracket_item::BracketItem;
    use super::super::bracket_set::BracketSet;
    use super::super::unit_matcher::UnitMatcher;
    use super::super::{TEST_OPTIONS, TEST_PATHNAME_OPTIONS, TEST_UNICODE_OPTIONS};
    use super::{GlobToken, read_star_run, tokenize_glob};

    #[test]
    fn reads_literal_bytes() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![
                GlobToken::One(UnitMatcher::Literal(b'a')),
                GlobToken::One(UnitMatcher::Literal(b'b')),
            ])
        );
    }

    #[test]
    fn reads_an_escaped_byte() {
        // Arrange
        let pattern = b"\\?";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![GlobToken::One(UnitMatcher::Escaped(b'?'))])
        );
    }

    #[test]
    fn reads_a_question_mark_as_any_byte() {
        // Arrange
        let pattern = b"?";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(result, Some(vec![GlobToken::One(UnitMatcher::Any)]));
    }

    #[test]
    fn reads_a_star_run() {
        // Arrange
        let pattern = b"**/a";

        // Act
        let result = tokenize_glob(pattern, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![
                GlobToken::AnyFolders,
                GlobToken::One(UnitMatcher::Literal(b'a')),
            ])
        );
    }

    #[test]
    fn reads_a_bracket_set() {
        // Arrange
        let pattern = b"[a]";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![GlobToken::One(UnitMatcher::Set(BracketSet {
                negated: false,
                items: vec![BracketItem::Char(u32::from(b'a'))],
            }))])
        );
    }

    #[test]
    fn reads_a_character_as_bytes_without_unicode() {
        // Arrange
        let pattern = "é".as_bytes();

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![
                GlobToken::One(UnitMatcher::Literal(0xC3)),
                GlobToken::One(UnitMatcher::Literal(0xA9)),
            ])
        );
    }

    #[test]
    fn reads_a_whole_character_with_unicode() {
        // Arrange
        let pattern = "é".as_bytes();

        // Act
        let result = tokenize_glob(pattern, TEST_UNICODE_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![GlobToken::One(UnitMatcher::Character(
                "é".as_bytes().to_vec()
            ))])
        );
    }

    #[test]
    fn reads_an_escaped_whole_character_with_unicode() {
        // Arrange
        let pattern = "\\é".as_bytes();

        // Act
        let result = tokenize_glob(pattern, TEST_UNICODE_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![GlobToken::One(UnitMatcher::Character(
                "é".as_bytes().to_vec()
            ))])
        );
    }

    #[test]
    fn reads_a_bracket_set_of_characters_with_unicode() {
        // Arrange
        let pattern = "[é]".as_bytes();

        // Act
        let result = tokenize_glob(pattern, TEST_UNICODE_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(vec![GlobToken::One(UnitMatcher::Set(BracketSet {
                negated: false,
                items: vec![BracketItem::Char(u32::from('é'))],
            }))])
        );
    }

    #[test]
    fn rejects_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_malformed_bracket_set() {
        // Arrange
        let pattern = b"a[b";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(result, None);
    }

    const CROSSING: GlobToken = GlobToken::Star {
        crosses_slash: true,
    };

    const IN_FOLDER: GlobToken = GlobToken::Star {
        crosses_slash: false,
    };

    #[test]
    fn crosses_slashes_without_pathname_mode() {
        // Arrange
        let pattern = b"a*b";

        // Act
        let result = read_star_run(pattern, 1, TEST_OPTIONS);

        // Assert
        assert_eq!(result, (CROSSING, 2));
    }

    #[test]
    fn reads_the_whole_run() {
        // Arrange
        let pattern = b"a***b";

        // Act
        let result = read_star_run(pattern, 1, TEST_OPTIONS);

        // Assert
        assert_eq!(result, (CROSSING, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_single_star_in_pathname_mode() {
        // Arrange
        let pattern = b"a/*";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }

    #[test]
    fn crosses_slashes_for_a_double_star_ending_the_pattern_after_a_slash() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (CROSSING, 4));
    }

    #[test]
    fn crosses_slashes_for_a_double_star_that_is_the_whole_pattern() {
        // Arrange
        let pattern = b"**";

        // Act
        let result = read_star_run(pattern, 0, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (CROSSING, 2));
    }

    #[test]
    fn matches_folders_for_a_double_star_starting_the_pattern_before_a_slash() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = read_star_run(pattern, 0, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (GlobToken::AnyFolders, 3));
    }

    #[test]
    fn matches_folders_for_a_double_star_between_slashes() {
        // Arrange
        let pattern = b"a/***/b";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (GlobToken::AnyFolders, 6));
    }

    #[test]
    fn crosses_slashes_for_a_double_star_before_an_escaped_slash() {
        // Arrange
        let pattern = b"a/**\\/b";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (CROSSING, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_before_another_escaped_byte() {
        // Arrange
        let pattern = b"a/**\\b";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (IN_FOLDER, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_after_other_bytes() {
        // Arrange
        let pattern = b"a**/b";

        // Act
        let result = read_star_run(pattern, 1, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_ending_the_pattern_after_other_bytes() {
        // Arrange
        let pattern = b"a**";

        // Act
        let result = read_star_run(pattern, 1, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_before_other_bytes() {
        // Arrange
        let pattern = b"a/**b";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (IN_FOLDER, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_single_star_between_slashes() {
        // Arrange
        let pattern = b"a/*/b";

        // Act
        let result = read_star_run(pattern, 2, TEST_PATHNAME_OPTIONS);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }
}
