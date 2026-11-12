/// Find the end of a `[...]` region while looking for brace groups.
///
/// Inside such a region, braces and commas don't take part in brace
/// expansion. Regions nest, so each `[` needs its own `]`, a `]` straight
/// after a `[` closes it, and a `\` escapes the byte after it.
///
/// # Arguments
///
/// * `pattern` - The pattern.
/// * `open` - Where the opening `[` is in the pattern.
///
/// # Returns
///
/// The index just past the region's closing `]`, or `None` if it's never
/// closed.
#[must_use]
pub(super) fn brace_bracket_end(pattern: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0_usize;
    let mut index = open;
    while index < pattern.len() {
        match pattern[index] {
            b'\\' => index += 1,
            b'[' => depth += 1,
            b']' => {
                depth -= 1;
                if depth == 0 {
                    return Some(index + 1);
                }
            }
            _ => {}
        }
        index += 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::brace_bracket_end;

    #[test]
    fn finds_the_closing_bracket() {
        // Arrange
        let pattern = b"x[a,b]y";

        // Act
        let result = brace_bracket_end(pattern, 1);

        // Assert
        assert_eq!(result, Some(6));
    }

    #[test]
    fn closes_at_a_bracket_straight_after_the_opening_one() {
        // Arrange
        let pattern = b"[]a]";

        // Act
        let result = brace_bracket_end(pattern, 0);

        // Assert
        assert_eq!(result, Some(2));
    }

    #[test]
    fn needs_a_closing_bracket_for_each_nested_opening_one() {
        // Arrange
        let pattern = b"[a[b]c]";

        // Act
        let result = brace_bracket_end(pattern, 0);

        // Assert
        assert_eq!(result, Some(7));
    }

    #[test]
    fn skips_an_escaped_closing_bracket() {
        // Arrange
        let pattern = b"[a\\]b]";

        // Act
        let result = brace_bracket_end(pattern, 0);

        // Assert
        assert_eq!(result, Some(6));
    }

    #[test]
    fn finds_nothing_for_an_unclosed_region() {
        // Arrange
        let pattern = b"[[a]";

        // Act
        let result = brace_bracket_end(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }
}
