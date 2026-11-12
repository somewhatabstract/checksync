use super::brace_bracket_end::brace_bracket_end;
use super::types::BraceGroup;

/// Find the brace group that a `{` starts, if it starts one.
///
/// A `{` starts a group when a matching `}` follows, with nested braces
/// balanced, and at least one comma lies between them outside any nested
/// braces. A `\` escapes the byte after it, and braces and commas inside a
/// `[...]` region don't count; an unclosed region means no group.
///
/// # Arguments
///
/// * `pattern` - The pattern.
/// * `open` - Where the `{` is in the pattern.
///
/// # Returns
///
/// The group's alternatives and end, or `None` if the `{` doesn't start a
/// group and is just a literal byte.
#[must_use]
pub(super) fn find_brace_group(pattern: &[u8], open: usize) -> Option<BraceGroup> {
    let mut depth = 0_usize;
    let mut alternatives = Vec::new();
    let mut start = open + 1;
    let mut index = start;
    while index < pattern.len() {
        match pattern[index] {
            b'\\' => index += 1,
            b'[' => {
                index = brace_bracket_end(pattern, index)?;
                continue;
            }
            b'{' => depth += 1,
            b'}' if depth > 0 => depth -= 1,
            b'}' => {
                if alternatives.is_empty() {
                    return None;
                }
                alternatives.push(start..index);
                return Some(BraceGroup {
                    alternatives,
                    end: index + 1,
                });
            }
            b',' if depth == 0 => {
                alternatives.push(start..index);
                start = index + 1;
            }
            _ => {}
        }
        index += 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::super::types::BraceGroup;
    use super::find_brace_group;

    #[test]
    fn finds_the_alternatives_of_a_group() {
        // Arrange
        let pattern = b"x{a,bc}y";

        // Act
        let result = find_brace_group(pattern, 1);

        // Assert
        assert_eq!(
            result,
            Some(BraceGroup {
                alternatives: vec![2..3, 4..6],
                end: 7,
            })
        );
    }

    #[test]
    fn keeps_a_nested_group_inside_one_alternative() {
        // Arrange
        let pattern = b"{a,b{c,d}}";

        // Act
        let result = find_brace_group(pattern, 0);

        // Assert
        assert_eq!(
            result,
            Some(BraceGroup {
                alternatives: vec![1..2, 3..9],
                end: 10,
            })
        );
    }

    #[test]
    fn finds_no_group_without_a_comma() {
        // Arrange
        let pattern = b"{a}";

        // Act
        let result = find_brace_group(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_no_group_without_a_closing_brace() {
        // Arrange
        let pattern = b"{a,b{c}";

        // Act
        let result = find_brace_group(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn ignores_escaped_braces_and_commas() {
        // Arrange
        let pattern = b"{a\\,b\\},c}";

        // Act
        let result = find_brace_group(pattern, 0);

        // Assert
        assert_eq!(
            result,
            Some(BraceGroup {
                alternatives: vec![1..7, 8..9],
                end: 10,
            })
        );
    }

    #[test]
    fn ignores_commas_inside_brackets() {
        // Arrange
        let pattern = b"{[a,b]}";

        // Act
        let result = find_brace_group(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_no_group_with_an_unclosed_bracket() {
        // Arrange
        let pattern = b"{a,[b}";

        // Act
        let result = find_brace_group(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }
}
