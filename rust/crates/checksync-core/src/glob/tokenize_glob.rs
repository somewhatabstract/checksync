use super::parse_bracket_set::parse_bracket_set;
use super::read_glob_char::read_glob_char;
use super::read_star_run::read_star_run;
use super::types::{GlobOptions, GlobToken, UnitMatcher};

/// Split a glob pattern into the tokens that each match part of the text.
///
/// # Arguments
///
/// * `pattern` - The glob pattern, without any NUL byte.
/// * `options` - How to treat slashes, which decides what `**` means, and
///   whether literals and bracket sets work on characters or bytes.
///
/// # Returns
///
/// The tokens, in order, or `None` if the pattern can never match anything:
/// it ends with a `\`, or has a malformed bracket set.
#[must_use]
pub(super) fn tokenize_glob(pattern: &[u8], options: GlobOptions) -> Option<Vec<GlobToken>> {
    let mut tokens = Vec::new();
    let mut index = 0;
    while index < pattern.len() {
        let (token, next) = match pattern[index] {
            b'?' => (GlobToken::One(UnitMatcher::Any), index + 1),
            b'*' => read_star_run(pattern, index, options),
            b'[' => {
                let (set, next) = parse_bracket_set(pattern, index, options.unicode)?;
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

#[cfg(test)]
mod tests {
    use super::super::TEST_OPTIONS;
    use super::super::TEST_PATHNAME_OPTIONS;
    use super::super::TEST_UNICODE_OPTIONS;
    use super::super::types::{BracketItem, BracketSet, GlobToken, UnitMatcher};
    use super::tokenize_glob;

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
}
