use super::parse_bracket_set::parse_bracket_set;
use super::read_glob_byte::read_glob_byte;
use super::read_star_run::read_star_run;
use super::types::{ByteMatcher, GlobOptions, GlobToken};

/// Split a glob pattern into the tokens that each match part of the text.
///
/// # Arguments
///
/// * `pattern` - The glob pattern, without any NUL byte.
/// * `options` - How to treat slashes, which decides what `**` means.
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
            b'?' => (GlobToken::One(ByteMatcher::Any), index + 1),
            b'*' => read_star_run(pattern, index, options),
            b'[' => {
                let (set, next) = parse_bracket_set(pattern, index)?;
                (GlobToken::One(ByteMatcher::Set(set)), next)
            }
            b'\\' => {
                let (byte, next) = read_glob_byte(pattern, index)?;
                (GlobToken::One(ByteMatcher::Escaped(byte)), next)
            }
            byte => (GlobToken::One(ByteMatcher::Literal(byte)), index + 1),
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
    use super::super::types::{BracketItem, BracketSet, ByteMatcher, GlobToken};
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
                GlobToken::One(ByteMatcher::Literal(b'a')),
                GlobToken::One(ByteMatcher::Literal(b'b')),
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
            Some(vec![GlobToken::One(ByteMatcher::Escaped(b'?'))])
        );
    }

    #[test]
    fn reads_a_question_mark_as_any_byte() {
        // Arrange
        let pattern = b"?";

        // Act
        let result = tokenize_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(result, Some(vec![GlobToken::One(ByteMatcher::Any)]));
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
                GlobToken::One(ByteMatcher::Literal(b'a')),
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
            Some(vec![GlobToken::One(ByteMatcher::Set(BracketSet {
                negated: false,
                items: vec![BracketItem::Byte(b'a')],
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
