//! Counting the output a brace expansion holds at once against its limits.

use super::BraceExpansionError;
use super::combine::{MAX_RESULT_BYTES, MAX_RESULTS};

/// The output a brace expansion holds at once, counted against its limits.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(super) struct BraceBudget {
    /// How many patterns, finished or partial, are held at once.
    pub(super) count: usize,
    /// How many bytes those patterns hold altogether.
    pub(super) bytes: usize,
}

/// The most patterns a brace expansion may hold at once while working.
///
/// An expansion whose final output fits the result limits, [`MAX_RESULTS`]
/// and [`MAX_RESULT_BYTES`], never holds more than twice its output, plus one
/// pattern per nesting level, which the 10,000-byte pattern limit keeps below
/// 10,000.
pub(super) const MAX_HELD: usize = 2 * MAX_RESULTS + 10_000;

/// The most bytes a brace expansion's patterns may hold at once.
///
/// An expansion whose final output fits the result limits, [`MAX_RESULTS`]
/// and [`MAX_RESULT_BYTES`], never holds more than twice its output's bytes.
pub(super) const MAX_HELD_BYTES: usize = 2 * MAX_RESULT_BYTES;

/// Counts more output against what a brace expansion may hold at once.
///
/// `budget` is the output held so far, and grows by `count` patterns of `bytes`
/// bytes when they fit. This bounds memory while groups nest, counting partial
/// results as well as finished ones: at most [`MAX_HELD`] (210,000) patterns and
/// [`MAX_HELD_BYTES`] (20,000,000) bytes at once. It never refuses an expansion
/// whose final output fits, since everything held at once is either part of that
/// output or about to be replaced by a larger part of it.
///
/// # Errors
///
/// Returns [`BraceExpansionError::TooManyResults`] if the new output doesn't fit,
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

/// Stops counting output a brace expansion no longer holds.
///
/// `budget` is reduced by the patterns no longer held. Debug builds check that
/// the budget covers the released output, which catches output released twice;
/// release builds stop at zero instead.
///
/// # Panics
///
/// In debug builds, panics if `budget` holds fewer patterns or bytes than are
/// being released.
pub(super) fn release_brace_budget(budget: &mut BraceBudget, patterns: &[Vec<u8>]) {
    let bytes: usize = patterns.iter().map(Vec::len).sum();
    debug_assert!(
        budget.count >= patterns.len() && budget.bytes >= bytes,
        "released more brace output than was counted"
    );
    budget.count = budget.count.saturating_sub(patterns.len());
    budget.bytes = budget.bytes.saturating_sub(bytes);
}

#[cfg(test)]
mod tests {
    use super::super::BraceExpansionError;
    use super::{BraceBudget, MAX_HELD, MAX_HELD_BYTES, release_brace_budget, take_brace_budget};

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

    #[test]
    fn subtracts_the_released_patterns_and_bytes() {
        // Arrange
        let mut budget = BraceBudget {
            count: 5,
            bytes: 10,
        };

        // Act
        release_brace_budget(&mut budget, &[b"ab".to_vec(), b"c".to_vec()]);

        // Assert
        assert_eq!(budget, BraceBudget { count: 3, bytes: 7 });
    }

    #[cfg(debug_assertions)]
    #[test]
    #[should_panic(expected = "released more brace output than was counted")]
    fn catches_releasing_more_patterns_than_were_counted_in_debug_builds() {
        // Arrange
        let mut budget = BraceBudget {
            count: 1,
            bytes: 10,
        };

        // Act
        release_brace_budget(&mut budget, &[b"ab".to_vec(), b"c".to_vec()]);

        // Assert
        // The call panics.
    }

    #[cfg(debug_assertions)]
    #[test]
    #[should_panic(expected = "released more brace output than was counted")]
    fn catches_releasing_more_bytes_than_were_counted_in_debug_builds() {
        // Arrange
        let mut budget = BraceBudget { count: 5, bytes: 1 };

        // Act
        release_brace_budget(&mut budget, &[b"ab".to_vec()]);

        // Assert
        // The call panics.
    }

    #[cfg(not(debug_assertions))]
    #[test]
    fn stops_at_zero_in_release_builds() {
        // Arrange
        let mut budget = BraceBudget { count: 1, bytes: 1 };

        // Act
        release_brace_budget(&mut budget, &[b"ab".to_vec(), b"c".to_vec()]);

        // Assert
        assert_eq!(budget, BraceBudget::default());
    }
}
