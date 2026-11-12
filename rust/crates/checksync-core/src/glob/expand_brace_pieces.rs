use super::combine_brace_texts::combine_brace_texts;
use super::read_brace_piece::read_brace_piece;
use super::take_brace_budget::take_brace_budget;
use super::types::{BraceBudget, BraceExpansionError};

/// Expand a pattern's brace groups piece by piece, within a shared budget.
///
/// `expand_braces` checks the pattern's length and nesting first; this is
/// also how alternatives of nested groups are expanded. The results are
/// counted against `budget` and stay counted when returned, until the
/// caller releases them.
///
/// # Arguments
///
/// * `pattern` - The pattern, or one alternative of a group in it.
/// * `budget` - The output the whole expansion holds at once.
///
/// # Returns
///
/// The expanded patterns, in order.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the output doesn't fit.
pub(super) fn expand_brace_pieces(
    pattern: &[u8],
    budget: &mut BraceBudget,
) -> Result<Vec<Vec<u8>>, BraceExpansionError> {
    take_brace_budget(budget, 1, 0)?;
    let mut results = vec![Vec::new()];
    let mut index = 0;
    while index < pattern.len() {
        let (texts, next) = read_brace_piece(pattern, index, budget)?;
        combine_brace_texts(&mut results, &texts, budget)?;
        index = next;
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::super::types::{BraceBudget, BraceExpansionError};
    use super::expand_brace_pieces;

    #[test]
    fn combines_the_pieces_in_order() {
        // Arrange
        let pattern = b"a{b,c}d";

        // Act
        let result = expand_brace_pieces(pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Ok(vec![b"abd".to_vec(), b"acd".to_vec()]));
    }

    #[test]
    fn gives_an_empty_pattern_for_an_empty_pattern() {
        // Arrange
        let pattern = b"";

        // Act
        let result = expand_brace_pieces(pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Ok(vec![Vec::new()]));
    }

    #[test]
    fn leaves_only_the_results_counted() {
        // Arrange
        let mut budget = BraceBudget::default();

        // Act
        let _ = expand_brace_pieces(b"a{b,c}d", &mut budget);

        // Assert
        assert_eq!(budget, BraceBudget { count: 2, bytes: 6 });
    }

    #[test]
    fn rejects_a_start_that_does_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: 100_000,
            bytes: 0,
        };

        // Act
        let result = expand_brace_pieces(b"", &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_combined_results_that_do_not_fit() {
        // Arrange
        let pattern = b"{a,b}".repeat(17);

        // Act
        let result = expand_brace_pieces(&pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_a_group_whose_alternatives_do_not_fit() {
        // Arrange
        let pattern = [b"x{y,".as_slice(), &b"{a,b}".repeat(17), b"}"].concat();

        // Act
        let result = expand_brace_pieces(&pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
