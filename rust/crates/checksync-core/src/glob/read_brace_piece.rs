use super::brace_bracket_end::brace_bracket_end;
use super::brace_output_fits::brace_output_fits;
use super::expand_brace_pieces::expand_brace_pieces;
use super::find_brace_group::find_brace_group;
use super::types::BraceExpansionError;

/// Read the next piece of a pattern being brace-expanded.
///
/// A piece is a brace group, which stands for each of its alternatives,
/// expanded in turn; a `\` and the byte after it; a `[...]` region, or the
/// rest of the pattern if the region is never closed; a `{` that starts no
/// group; or a run of other bytes. Everything but a brace group is kept
/// exactly as written.
///
/// # Arguments
///
/// * `pattern` - The pattern.
/// * `index` - Where the piece starts. Must be within the pattern.
///
/// # Returns
///
/// The texts the piece stands for, in order, and the index just past it.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if a group's alternatives expand
/// to too large an output.
pub(super) fn read_brace_piece(
    pattern: &[u8],
    index: usize,
) -> Result<(Vec<Vec<u8>>, usize), BraceExpansionError> {
    let end = match pattern[index] {
        b'\\' => (index + 2).min(pattern.len()),
        b'[' => brace_bracket_end(pattern, index).unwrap_or(pattern.len()),
        b'{' => match find_brace_group(pattern, index) {
            Some(group) => {
                let mut texts = Vec::new();
                let mut bytes = 0_usize;
                for alternative in group.alternatives {
                    let expanded = expand_brace_pieces(&pattern[alternative])?;
                    bytes += expanded.iter().map(Vec::len).sum::<usize>();
                    texts.extend(expanded);
                    if !brace_output_fits(texts.len(), bytes) {
                        return Err(BraceExpansionError::TooManyResults);
                    }
                }
                return Ok((texts, group.end));
            }
            None => index + 1,
        },
        _ => pattern[index..]
            .iter()
            .position(|byte| matches!(byte, b'\\' | b'[' | b'{'))
            .map_or(pattern.len(), |offset| index + offset),
    };
    Ok((vec![pattern[index..end].to_vec()], end))
}

#[cfg(test)]
mod tests {
    use super::super::types::BraceExpansionError;
    use super::read_brace_piece;

    #[test]
    fn reads_a_run_of_ordinary_bytes() {
        // Arrange
        let pattern = b"ab,}{c,d}";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, Ok((vec![b"ab,}".to_vec()], 4)));
    }

    #[test]
    fn reads_ordinary_bytes_to_the_end() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, Ok((vec![b"ab".to_vec()], 2)));
    }

    #[test]
    fn reads_an_escape_and_the_byte_after_it() {
        // Arrange
        let pattern = b"\\{a";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, Ok((vec![b"\\{".to_vec()], 2)));
    }

    #[test]
    fn reads_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = read_brace_piece(pattern, 1);

        // Assert
        assert_eq!(result, Ok((vec![b"\\".to_vec()], 2)));
    }

    #[test]
    fn reads_a_bracket_region_whole() {
        // Arrange
        let pattern = b"[{a,b}]c";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, Ok((vec![b"[{a,b}]".to_vec()], 7)));
    }

    #[test]
    fn reads_the_rest_after_an_unclosed_bracket() {
        // Arrange
        let pattern = b"[{a,b}";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, Ok((vec![b"[{a,b}".to_vec()], 6)));
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
            Ok((vec![b"a".to_vec(), b"bc".to_vec(), b"bd".to_vec()], 10))
        );
    }

    #[test]
    fn reads_a_brace_that_starts_no_group_as_a_byte() {
        // Arrange
        let pattern = b"{a}";

        // Act
        let result = read_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, Ok((vec![b"{".to_vec()], 1)));
    }

    #[test]
    fn rejects_an_alternative_that_expands_too_far() {
        // Arrange
        let pattern = [b"{x,".as_slice(), &b"{a,b}".repeat(17), b"}"].concat();

        // Act
        let result = read_brace_piece(&pattern, 0);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_alternatives_that_add_up_to_too_many_results() {
        // Arrange
        let alternative = b"{a,b}".repeat(16);
        let pattern = [b"{".as_slice(), &alternative, b",", &alternative, b"}"].concat();

        // Act
        let result = read_brace_piece(&pattern, 0);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
