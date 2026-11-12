use super::take_brace_budget::take_brace_budget;
use super::types::{BraceBudget, BraceExpansionError, BraceFrame};

/// Start expanding a run of a pattern, with one empty result so far.
///
/// # Arguments
///
/// * `run` - Where the run lies in the pattern.
/// * `budget` - The output the whole expansion holds at once, which gains
///   the empty result.
///
/// # Returns
///
/// The frame that expands the run.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the empty result doesn't fit.
pub(super) fn start_brace_sequence(
    run: std::ops::Range<usize>,
    budget: &mut BraceBudget,
) -> Result<BraceFrame, BraceExpansionError> {
    take_brace_budget(budget, 1, 0)?;
    Ok(BraceFrame::Sequence {
        end: run.end,
        index: run.start,
        results: vec![Vec::new()],
    })
}

#[cfg(test)]
mod tests {
    use super::super::types::{BraceBudget, BraceExpansionError, BraceFrame};
    use super::start_brace_sequence;

    #[test]
    fn starts_with_one_empty_result() {
        // Arrange
        let mut budget = BraceBudget::default();

        // Act
        let result = start_brace_sequence(2..5, &mut budget);

        // Assert
        assert_eq!(
            result,
            Ok(BraceFrame::Sequence {
                end: 5,
                index: 2,
                results: vec![Vec::new()],
            })
        );
    }

    #[test]
    fn counts_the_empty_result() {
        // Arrange
        let mut budget = BraceBudget::default();

        // Act
        let _ = start_brace_sequence(0..1, &mut budget);

        // Assert
        assert_eq!(budget, BraceBudget { count: 1, bytes: 0 });
    }

    #[test]
    fn rejects_a_start_that_does_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: 100_000,
            bytes: 0,
        };

        // Act
        let result = start_brace_sequence(0..1, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
