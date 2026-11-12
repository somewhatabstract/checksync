use super::types::{BraceBudget, BraceExpansionError};

/// The most patterns a brace expansion may hold at once.
const MAX_COUNT: usize = 100_000;

/// The most bytes a brace expansion's patterns may hold at once.
const MAX_BYTES: usize = 10_000_000;

/// Count more output against a brace expansion's limits.
///
/// An expansion may hold at most 100,000 patterns, and at most 10,000,000
/// bytes of them, at any one time, counting partial results as well as
/// finished ones, so no pattern can exhaust memory.
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
    if count > MAX_COUNT || bytes > MAX_BYTES {
        return Err(BraceExpansionError::TooManyResults);
    }
    *budget = BraceBudget { count, bytes };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::types::{BraceBudget, BraceExpansionError};
    use super::{MAX_BYTES, MAX_COUNT, take_brace_budget};

    #[test]
    fn counts_output_up_to_the_limits() {
        // Arrange
        let mut budget = BraceBudget { count: 1, bytes: 1 };

        // Act
        let _ = take_brace_budget(&mut budget, MAX_COUNT - 1, MAX_BYTES - 1);

        // Assert
        assert_eq!(
            budget,
            BraceBudget {
                count: MAX_COUNT,
                bytes: MAX_BYTES
            }
        );
    }

    #[test]
    fn rejects_too_many_patterns() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_COUNT,
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
            bytes: MAX_BYTES,
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
