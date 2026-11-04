/// Check whether a character is whitespace the way JavaScript defines it.
///
/// This is what `\s` matches in a JavaScript regular expression, with or
/// without the `u` flag, and what `String.prototype.trim()` removes: the
/// ECMAScript `WhiteSpace` and `LineTerminator` characters. It differs from
/// Rust's [`char::is_whitespace`] in two places: it includes U+FEFF, the byte
/// order mark, and leaves out U+0085, NEL.
///
/// # Arguments
///
/// * `c` - The character to check.
///
/// # Returns
///
/// `true` if JavaScript treats the character as whitespace.
#[must_use]
pub fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{B}' | '\u{C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

#[cfg(test)]
mod tests {
    use super::is_js_whitespace;

    #[test]
    fn accepts_ascii_whitespace() {
        // Arrange
        let chars = ['\t', '\n', '\u{B}', '\u{C}', '\r', ' '];

        // Act
        let result = chars.iter().all(|&c| is_js_whitespace(c));

        // Assert
        assert!(result);
    }

    #[test]
    fn accepts_the_byte_order_mark() {
        // Arrange
        let c = '\u{FEFF}';

        // Act
        let result = is_js_whitespace(c);

        // Assert
        assert!(result);
    }

    #[test]
    fn accepts_unicode_space_separators() {
        // Arrange
        let chars = [
            '\u{A0}', '\u{1680}', '\u{2000}', '\u{2005}', '\u{200A}', '\u{202F}', '\u{205F}',
            '\u{3000}',
        ];

        // Act
        let result = chars.iter().all(|&c| is_js_whitespace(c));

        // Assert
        assert!(result);
    }

    #[test]
    fn accepts_unicode_line_and_paragraph_separators() {
        // Arrange
        let chars = ['\u{2028}', '\u{2029}'];

        // Act
        let result = chars.iter().all(|&c| is_js_whitespace(c));

        // Assert
        assert!(result);
    }

    #[test]
    fn rejects_nel() {
        // Arrange
        let c = '\u{85}';

        // Act
        let result = is_js_whitespace(c);

        // Assert
        assert!(!result);
    }

    #[test]
    fn rejects_characters_that_are_no_longer_or_never_were_spaces() {
        // Arrange
        // U+180E was a space separator before Unicode 6.3, and U+200B is a
        // zero-width space, which isn't a space separator.
        let chars = ['\u{180E}', '\u{200B}', 'a', '\0'];

        // Act
        let result = chars.iter().any(|&c| is_js_whitespace(c));

        // Assert
        assert!(!result);
    }

    #[test]
    fn accepts_exactly_the_25_javascript_whitespace_characters() {
        // Arrange
        let all = (0..=u32::from(char::MAX)).filter_map(char::from_u32);

        // Act
        let count = all.filter(|&c| is_js_whitespace(c)).count();

        // Assert
        assert_eq!(count, 25);
    }
}
