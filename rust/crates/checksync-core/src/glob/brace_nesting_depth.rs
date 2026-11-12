use super::brace_bracket_end::brace_bracket_end;

/// Measure how deeply the braces in a pattern nest.
///
/// Every `{` counts, whether or not it starts a group, so this is never
/// less than how deeply the groups nest. A stray `}` doesn't take the count
/// below zero. Escaped braces and braces inside `[...]` don't count, and an
/// unclosed `[` ends the count, as it hides the rest of the pattern from
/// brace expansion.
///
/// # Arguments
///
/// * `pattern` - The pattern.
///
/// # Returns
///
/// The deepest nesting of braces anywhere in the pattern.
#[must_use]
pub(super) fn brace_nesting_depth(pattern: &[u8]) -> usize {
    let mut depth = 0_usize;
    let mut deepest = 0;
    let mut index = 0;
    while index < pattern.len() {
        match pattern[index] {
            b'\\' => index += 1,
            b'[' => match brace_bracket_end(pattern, index) {
                Some(end) => {
                    index = end;
                    continue;
                }
                None => break,
            },
            b'{' => {
                depth += 1;
                deepest = deepest.max(depth);
            }
            b'}' => depth = depth.saturating_sub(1),
            _ => {}
        }
        index += 1;
    }
    deepest
}

#[cfg(test)]
mod tests {
    use super::brace_nesting_depth;

    #[test]
    fn measures_nested_groups() {
        // Arrange
        let pattern = b"{a,{b,{c,d}}}{e,f}";

        // Act
        let result = brace_nesting_depth(pattern);

        // Assert
        assert_eq!(result, 3);
    }

    #[test]
    fn counts_braces_that_start_no_group() {
        // Arrange
        let pattern = b"{{a";

        // Act
        let result = brace_nesting_depth(pattern);

        // Assert
        assert_eq!(result, 2);
    }

    #[test]
    fn does_not_go_below_zero_for_a_stray_closing_brace() {
        // Arrange
        let pattern = b"}}{a}";

        // Act
        let result = brace_nesting_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }

    #[test]
    fn skips_escaped_braces() {
        // Arrange
        let pattern = b"\\{\\{{a}";

        // Act
        let result = brace_nesting_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }

    #[test]
    fn skips_braces_inside_brackets() {
        // Arrange
        let pattern = b"[{{]{a}";

        // Act
        let result = brace_nesting_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }

    #[test]
    fn stops_at_an_unclosed_bracket() {
        // Arrange
        let pattern = b"{a}[{{";

        // Act
        let result = brace_nesting_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }
}
