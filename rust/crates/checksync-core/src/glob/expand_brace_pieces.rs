use super::start_brace_sequence::start_brace_sequence;
use super::step_brace_frame::step_brace_frame;
use super::types::{BraceBudget, BraceExpansionError};

/// Expand a pattern's brace groups with a heap stack, within a budget.
///
/// `expand_braces` checks the pattern's length first. Nested groups are
/// expanded through frames on a stack kept on the heap rather than through
/// recursion, so the call stack stays the same size whatever the input.
///
/// # Arguments
///
/// * `pattern` - The pattern.
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
    let mut stack = vec![start_brace_sequence(0..pattern.len(), budget)?];
    let mut expanded = Vec::new();
    // The stack empties just after the step that finishes the expansion.
    while let Some(frame) = stack.pop() {
        if let Some(results) = step_brace_frame(pattern, frame, &mut stack, budget)? {
            expanded = results;
        }
    }
    Ok(expanded)
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
    fn expands_nested_groups() {
        // Arrange
        let pattern = b"x{a,b{c,d}}y";

        // Act
        let result = expand_brace_pieces(pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(
            result,
            Ok(vec![b"xay".to_vec(), b"xbcy".to_vec(), b"xbdy".to_vec()])
        );
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
}
