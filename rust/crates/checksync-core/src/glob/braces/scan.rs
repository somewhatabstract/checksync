//! Scanning a pattern for brace groups and the bracket regions that hide them.

/// Checks whether a pattern holds any brace group, in one pass.
///
/// A `{` starts a group, as [`BracePiece::read`] decides, when a matching `}`
/// follows with a comma directly between them. A `\` escapes the byte after it,
/// braces and commas inside `[...]` don't count, and an unclosed `[` hides the
/// rest of the pattern, as in brace expansion. The time taken grows only with the
/// pattern's length.
///
/// [`BracePiece::read`]: super::group::BracePiece::read
#[must_use]
pub(super) fn contains_brace_group(pattern: &[u8]) -> bool {
    // For each `{` still waiting for its `}`, whether a comma has been seen
    // directly inside it.
    let mut open: Vec<bool> = Vec::new();
    let mut index = 0;
    while index < pattern.len() {
        match pattern[index] {
            b'\\' => index += 1,
            b'[' => match brace_bracket_end(pattern, index) {
                Some(end) => {
                    index = end;
                    continue;
                }
                None => return false,
            },
            b'{' => open.push(false),
            b',' => {
                if let Some(has_comma) = open.last_mut() {
                    *has_comma = true;
                }
            }
            b'}' if open.pop() == Some(true) => return true,
            _ => {}
        }
        index += 1;
    }
    false
}

/// Returns the index just past a `[...]` region, while looking for brace groups.
///
/// `open` is where the region's `[` is in `pattern`. Inside such a region, braces
/// and commas don't take part in brace expansion. Regions nest, so each `[` needs
/// its own `]`, a `]` straight after a `[` closes it, and a `\` escapes the byte
/// after it. Returns `None` if the region is never closed.
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
    use super::{brace_bracket_end, contains_brace_group};

    #[test]
    fn finds_a_group() {
        // Arrange
        let pattern = b"x{a,b}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_no_group_without_braces() {
        // Arrange
        let pattern = b"a*b";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_no_group_in_braces_without_a_comma() {
        // Arrange
        let pattern = b"{{{a}}}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_a_group_inside_braces_without_a_comma() {
        // Arrange
        let pattern = b"{x{a,b}}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_no_group_in_unclosed_braces() {
        // Arrange
        let pattern = b"x{x{x{a,";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_stray_closing_brace() {
        // Arrange
        let pattern = b"}a,b}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn skips_escaped_braces_and_commas() {
        // Arrange
        let pattern = b"{a\\,b\\}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn skips_commas_inside_brackets() {
        // Arrange
        let pattern = b"{[a,b]}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_a_group_after_a_closed_bracket() {
        // Arrange
        let pattern = b"[x]{a,b}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn stops_at_an_unclosed_bracket() {
        // Arrange
        let pattern = b"{a,[b}";

        // Act
        let result = contains_brace_group(pattern);

        // Assert
        assert!(!result);
    }

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
