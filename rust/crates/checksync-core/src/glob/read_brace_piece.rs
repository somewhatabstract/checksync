use super::brace_bracket_end::brace_bracket_end;
use super::expand_braces::expand_braces;
use super::find_brace_group::find_brace_group;

/// Read the next piece of a pattern being brace-expanded.
///
/// A piece is a brace group, which stands for each of its alternatives,
/// expanded in turn; a `\` and the byte after it; a `[...]` region, or the
/// rest of the pattern if the region is never closed; or a single byte.
/// Everything but a brace group is kept exactly as written.
///
/// # Arguments
///
/// * `pattern` - The pattern.
/// * `index` - Where the piece starts. Must be within the pattern.
///
/// # Returns
///
/// The texts the piece stands for, in order, and the index just past it.
#[must_use]
pub(super) fn read_brace_piece(pattern: &[u8], index: usize) -> (Vec<Vec<u8>>, usize) {
    let end = match pattern[index] {
        b'\\' => (index + 2).min(pattern.len()),
        b'[' => brace_bracket_end(pattern, index).unwrap_or(pattern.len()),
        b'{' => match find_brace_group(pattern, index) {
            Some(group) => {
                let texts = group
                    .alternatives
                    .into_iter()
                    .flat_map(|alternative| expand_braces(&pattern[alternative]))
                    .collect();
                return (texts, group.end);
            }
            None => index + 1,
        },
        _ => index + 1,
    };
    (vec![pattern[index..end].to_vec()], end)
}

#[cfg(test)]
mod tests {
    use super::read_brace_piece;

    #[test]
    fn reads_a_byte() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, (vec![b"a".to_vec()], 1));
    }

    #[test]
    fn reads_an_escape_and_the_byte_after_it() {
        // Arrange
        let pattern = b"\\{a";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, (vec![b"\\{".to_vec()], 2));
    }

    #[test]
    fn reads_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = read_brace_piece(pattern, 1);

        // Assert
        assert_eq!(result, (vec![b"\\".to_vec()], 2));
    }

    #[test]
    fn reads_a_bracket_region_whole() {
        // Arrange
        let pattern = b"[{a,b}]c";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, (vec![b"[{a,b}]".to_vec()], 7));
    }

    #[test]
    fn reads_the_rest_after_an_unclosed_bracket() {
        // Arrange
        let pattern = b"[{a,b}";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, (vec![b"[{a,b}".to_vec()], 6));
    }

    #[test]
    fn reads_a_group_as_its_expanded_alternatives() {
        // Arrange
        let pattern = b"{a,b{c,d}}e";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(
            result,
            (vec![b"a".to_vec(), b"bc".to_vec(), b"bd".to_vec()], 10)
        );
    }

    #[test]
    fn reads_a_brace_that_starts_no_group_as_a_byte() {
        // Arrange
        let pattern = b"{a}";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, (vec![b"{".to_vec()], 1));
    }
}
