/// The most patterns one brace expansion may give.
pub(super) const MAX_RESULTS: usize = 100_000;

/// The most bytes, across all its patterns, one brace expansion may give.
pub(super) const MAX_RESULT_BYTES: usize = 10_000_000;

/// Check whether a set of brace expansion results is within the limits.
///
/// Every set of results built during an expansion becomes part of the
/// final output, so checking each set as it's built refuses exactly the
/// expansions whose final output would be too large, whatever order their
/// groups come in.
///
/// # Arguments
///
/// * `count` - How many patterns the set holds.
/// * `bytes` - How many bytes those patterns hold altogether.
///
/// # Returns
///
/// `true` if the set holds at most 100,000 patterns and 10,000,000 bytes.
#[must_use]
pub(super) fn brace_results_fit(count: usize, bytes: usize) -> bool {
    count <= MAX_RESULTS && bytes <= MAX_RESULT_BYTES
}

#[cfg(test)]
mod tests {
    use super::{MAX_RESULT_BYTES, MAX_RESULTS, brace_results_fit};

    #[test]
    fn accepts_results_at_the_limits() {
        // Arrange
        let count = MAX_RESULTS;

        // Act
        let result = brace_results_fit(count, MAX_RESULT_BYTES);

        // Assert
        assert!(result);
    }

    #[test]
    fn rejects_too_many_patterns() {
        // Arrange
        let count = MAX_RESULTS + 1;

        // Act
        let result = brace_results_fit(count, 0);

        // Assert
        assert!(!result);
    }

    #[test]
    fn rejects_too_many_bytes() {
        // Arrange
        let bytes = MAX_RESULT_BYTES + 1;

        // Act
        let result = brace_results_fit(1, bytes);

        // Assert
        assert!(!result);
    }
}
