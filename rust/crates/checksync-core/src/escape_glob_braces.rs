use std::borrow::Cow;

/// Escape the braces in a `.gitignore` pattern so they match themselves.
///
/// Git treats `{` and `}` as ordinary characters, but the `ignore` crate's
/// globs read `{a,b}` as a choice between `a` and `b`. Escaping them keeps
/// git's meaning. A brace that's already escaped, and the character after
/// any other backslash, are left as they are.
///
/// # Arguments
///
/// * `pattern` - One line of an ignore file.
///
/// # Returns
///
/// The pattern with every unescaped brace escaped, borrowed unchanged when it
/// has none.
#[must_use]
pub(crate) fn escape_glob_braces(pattern: &str) -> Cow<'_, str> {
    if !pattern.contains(['{', '}']) {
        return Cow::Borrowed(pattern);
    }
    let mut escaped = String::with_capacity(pattern.len() + 4);
    let mut chars = pattern.chars();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                escaped.push(c);
                escaped.extend(chars.next());
            }
            '{' | '}' => {
                escaped.push('\\');
                escaped.push(c);
            }
            _ => escaped.push(c),
        }
    }
    Cow::Owned(escaped)
}

#[cfg(test)]
mod tests {
    use std::borrow::Cow;

    use super::escape_glob_braces;

    #[test]
    fn borrows_a_pattern_without_braces() {
        // Arrange
        let pattern = "*.log";

        // Act
        let result = escape_glob_braces(pattern);

        // Assert
        assert!(matches!(result, Cow::Borrowed("*.log")));
    }

    #[test]
    fn escapes_braces() {
        // Arrange
        let pattern = "{a,b}";

        // Act
        let result = escape_glob_braces(pattern);

        // Assert
        assert_eq!(result, r"\{a,b\}");
    }

    #[test]
    fn leaves_an_escaped_brace_alone() {
        // Arrange
        let pattern = r"\{a}";

        // Act
        let result = escape_glob_braces(pattern);

        // Assert
        assert_eq!(result, r"\{a\}");
    }

    #[test]
    fn leaves_the_character_after_a_backslash_alone() {
        // Arrange
        let pattern = r"\*{";

        // Act
        let result = escape_glob_braces(pattern);

        // Assert
        assert_eq!(result, r"\*\{");
    }

    #[test]
    fn keeps_a_trailing_backslash() {
        // Arrange
        let pattern = "{\\";

        // Act
        let result = escape_glob_braces(pattern);

        // Assert
        assert_eq!(result, "\\{\\");
    }
}
