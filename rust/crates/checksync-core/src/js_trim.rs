use crate::is_js_whitespace::is_js_whitespace;

/// Remove leading and trailing whitespace the way JavaScript's `trim()` does.
///
/// Unlike [`str::trim`], this removes a byte order mark (U+FEFF) and keeps
/// NEL (U+0085). See [`is_js_whitespace`].
///
/// # Arguments
///
/// * `text` - The text to trim.
///
/// # Returns
///
/// `text` without its leading and trailing whitespace.
#[must_use]
pub fn js_trim(text: &str) -> &str {
    text.trim_matches(is_js_whitespace)
}

#[cfg(test)]
mod tests {
    use super::js_trim;

    #[test]
    fn removes_ascii_whitespace_from_both_ends() {
        // Arrange
        let text = " \t a b \r\n";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "a b");
    }

    #[test]
    fn removes_a_leading_byte_order_mark() {
        // Arrange
        let text = "\u{FEFF}// sync-start:x a.js";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "// sync-start:x a.js");
    }

    #[test]
    fn removes_unicode_spaces_and_line_separators() {
        // Arrange
        let text = "\u{A0}\u{3000}a\u{2028}\u{2029}";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "a");
    }

    #[test]
    fn keeps_nel() {
        // Arrange
        let text = "\u{85}a\u{85}";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "\u{85}a\u{85}");
    }

    #[test]
    fn keeps_whitespace_inside_the_text() {
        // Arrange
        let text = " a \u{FEFF} b ";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "a \u{FEFF} b");
    }

    #[test]
    fn trims_whitespace_only_text_to_empty() {
        // Arrange
        let text = " \u{FEFF}\t";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "");
    }
}
