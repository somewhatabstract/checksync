use super::combine_brace_texts::combine_brace_texts;
use super::read_brace_piece::read_brace_piece;
use super::types::BraceExpansionError;

/// Expand a pattern's brace groups, piece by piece, without checking its
/// length or nesting.
///
/// `expand_braces` checks those first; this is the part that alternatives
/// of nested groups are expanded with.
///
/// # Arguments
///
/// * `pattern` - The pattern, or one alternative of a group in it.
///
/// # Returns
///
/// The expanded patterns, in order.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the expansion would be too
/// large.
pub(super) fn expand_brace_pieces(pattern: &[u8]) -> Result<Vec<Vec<u8>>, BraceExpansionError> {
    let mut results = vec![Vec::new()];
    let mut index = 0;
    while index < pattern.len() {
        let (texts, next) = read_brace_piece(pattern, index)?;
        combine_brace_texts(&mut results, &texts)?;
        index = next;
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::super::types::BraceExpansionError;
    use super::expand_brace_pieces;

    #[test]
    fn combines_the_pieces_in_order() {
        // Arrange
        let pattern = b"a{b,c}d";

        // Act
        let result = expand_brace_pieces(pattern);

        // Assert
        assert_eq!(result, Ok(vec![b"abd".to_vec(), b"acd".to_vec()]));
    }

    #[test]
    fn gives_an_empty_pattern_for_an_empty_pattern() {
        // Arrange
        let pattern = b"";

        // Act
        let result = expand_brace_pieces(pattern);

        // Assert
        assert_eq!(result, Ok(vec![Vec::new()]));
    }

    #[test]
    fn rejects_an_expansion_with_too_many_results() {
        // Arrange
        let pattern = b"{a,b}".repeat(17);

        // Act
        let result = expand_brace_pieces(&pattern);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_a_group_whose_alternatives_expand_too_far() {
        // Arrange
        let pattern = [b"x{y,".as_slice(), &b"{a,b}".repeat(17), b"}"].concat();

        // Act
        let result = expand_brace_pieces(&pattern);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
