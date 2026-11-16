use super::brace_results_fit::{MAX_RESULT_BYTES, MAX_RESULTS};
use super::types::{BraceBudget, BraceExpansionError};

/// The most patterns a brace expansion may hold at once while working.
///
/// An expansion whose final output fits `brace_results_fit` never holds
/// more than twice its output, plus one pattern per nesting level, which
/// the 10,000-byte pattern limit keeps below 10,000.
pub(super) const MAX_HELD: usize = 2 * MAX_RESULTS + 10_000;

/// The most bytes a brace expansion's patterns may hold at once.
///
/// An expansion whose final output fits `brace_results_fit` never holds
/// more than twice its output's bytes.
pub(super) const MAX_HELD_BYTES: usize = 2 * MAX_RESULT_BYTES;

/// Count more output against what a brace expansion may hold at once.
///
/// This bounds memory while groups nest, counting partial results as well
/// as finished ones: at most 210,000 patterns and 20,000,000 bytes at once.
/// It never refuses an expansion whose final output fits, since everything
/// held at once is either part of that output or about to be replaced by a
/// larger part of it.
///
/// # Arguments
///
/// * `budget` - The output held so far, increased by the new output when
///   it fits.
/// * `count` - How many more patterns are about to be held.
/// * `bytes` - How many more bytes they hold.
///
/// # Returns
///
/// Nothing, once the output has been counted.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the new output doesn't fit,
/// leaving `budget` as it was.
pub(super) fn take_brace_budget(
    budget: &mut BraceBudget,
    count: usize,
    bytes: usize,
) -> Result<(), BraceExpansionError> {
    let count = budget.count.saturating_add(count);
    let bytes = budget.bytes.saturating_add(bytes);
    if count > MAX_HELD || bytes > MAX_HELD_BYTES {
        return Err(BraceExpansionError::TooManyResults);
    }
    *budget = BraceBudget { count, bytes };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::types::{BraceBudget, BraceExpansionError};
    use super::{MAX_HELD, MAX_HELD_BYTES, take_brace_budget};

    #[test]
    fn counts_output_up_to_the_limits() {
        // Arrange
        let mut budget = BraceBudget { count: 1, bytes: 1 };

        // Act
        let _ = take_brace_budget(&mut budget, MAX_HELD - 1, MAX_HELD_BYTES - 1);

        // Assert
        assert_eq!(
            budget,
            BraceBudget {
                count: MAX_HELD,
                bytes: MAX_HELD_BYTES
            }
        );
    }

    #[test]
    fn rejects_too_many_patterns() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_HELD,
            bytes: 0,
        };

        // Act
        let result = take_brace_budget(&mut budget, 1, 0);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_too_many_bytes() {
        // Arrange
        let mut budget = BraceBudget {
            count: 0,
            bytes: MAX_HELD_BYTES,
        };

        // Act
        let result = take_brace_budget(&mut budget, 0, 1);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn leaves_the_budget_alone_when_rejecting() {
        // Arrange
        let mut budget = BraceBudget { count: 5, bytes: 5 };

        // Act
        let _ = take_brace_budget(&mut budget, usize::MAX, 0);

        // Assert
        assert_eq!(budget, BraceBudget { count: 5, bytes: 5 });
    }
}
