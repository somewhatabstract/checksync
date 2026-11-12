use super::brace_bracket_end::brace_bracket_end;

/// One `{` still waiting for its `}` while measuring group depth.
struct OpenBrace {
    /// Whether a comma has been seen directly inside it.
    has_comma: bool,
    /// The deepest group nesting found inside it so far.
    inner_depth: usize,
}

/// Measure how deeply the brace groups in a pattern nest, in one pass.
///
/// Only a `{` that starts a group, as `find_brace_group` decides, counts:
/// one with a matching `}` and a comma directly inside. A `{` that starts no
/// group, or a stray `}`, adds nothing. A `\` escapes the byte after it,
/// braces and commas inside `[...]` don't count, and an unclosed `[` hides
/// the rest of the pattern, as in brace expansion. The time taken grows
/// only with the pattern's length.
///
/// # Arguments
///
/// * `pattern` - The pattern.
///
/// # Returns
///
/// The deepest nesting of groups, or 0 if the pattern has no group.
#[must_use]
pub(super) fn brace_group_depth(pattern: &[u8]) -> usize {
    let mut open: Vec<OpenBrace> = Vec::new();
    let mut outer_depth = 0;
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
            b'{' => open.push(OpenBrace {
                has_comma: false,
                inner_depth: 0,
            }),
            b',' => {
                if let Some(brace) = open.last_mut() {
                    brace.has_comma = true;
                }
            }
            b'}' => {
                if let Some(brace) = open.pop() {
                    let depth = brace.inner_depth + usize::from(brace.has_comma);
                    let outer = open
                        .last_mut()
                        .map_or(&mut outer_depth, |b| &mut b.inner_depth);
                    *outer = (*outer).max(depth);
                }
            }
            _ => {}
        }
        index += 1;
    }
    // Braces never closed start no group, but groups inside them still count.
    open.iter()
        .map(|brace| brace.inner_depth)
        .fold(outer_depth, usize::max)
}

#[cfg(test)]
mod tests {
    use super::brace_group_depth;

    #[test]
    fn measures_nested_groups() {
        // Arrange
        let pattern = b"{a,{b,{c,d}}}{e,f}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 3);
    }

    #[test]
    fn finds_no_group_in_a_pattern_without_braces() {
        // Arrange
        let pattern = b"a*b";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }

    #[test]
    fn does_not_count_braces_without_a_comma() {
        // Arrange
        let pattern = b"{{{a}}}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }

    #[test]
    fn counts_a_group_inside_braces_without_a_comma() {
        // Arrange
        let pattern = b"{x{a,b}}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }

    #[test]
    fn does_not_count_commas_inside_nested_braces() {
        // Arrange
        let pattern = b"{x{a,b}y}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }

    #[test]
    fn does_not_count_unclosed_braces() {
        // Arrange
        let pattern = b"x{x{x{a,";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }

    #[test]
    fn counts_a_group_inside_an_unclosed_brace() {
        // Arrange
        let pattern = b"{x{a,b}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 1);
    }

    #[test]
    fn ignores_a_stray_closing_brace() {
        // Arrange
        let pattern = b"}a,b}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }

    #[test]
    fn skips_escaped_braces_and_commas() {
        // Arrange
        let pattern = b"{a\\,b\\}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }

    #[test]
    fn skips_commas_inside_brackets() {
        // Arrange
        let pattern = b"{[a,b]}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }

    #[test]
    fn stops_at_an_unclosed_bracket() {
        // Arrange
        let pattern = b"{a,[b}";

        // Act
        let result = brace_group_depth(pattern);

        // Assert
        assert_eq!(result, 0);
    }
}
