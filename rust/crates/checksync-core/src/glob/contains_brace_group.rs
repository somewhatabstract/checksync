use super::brace_bracket_end::brace_bracket_end;

/// Check whether a pattern holds any brace group, in one pass.
///
/// A `{` starts a group, as `find_brace_group` decides, when a matching `}`
/// follows with a comma directly between them. A `\` escapes the byte after
/// it, braces and commas inside `[...]` don't count, and an unclosed `[`
/// hides the rest of the pattern, as in brace expansion. The time taken
/// grows only with the pattern's length.
///
/// # Arguments
///
/// * `pattern` - The pattern.
///
/// # Returns
///
/// `true` if the pattern holds at least one group.
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

#[cfg(test)]
mod tests {
    use super::contains_brace_group;

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
}
