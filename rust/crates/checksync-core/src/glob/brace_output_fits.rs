/// The most patterns one brace expansion may give.
const MAX_RESULTS: usize = 100_000;

/// The most bytes, across all its patterns, one brace expansion may give.
const MAX_BYTES: usize = 10_000_000;

/// Check whether a brace expansion's output is within the limits.
///
/// An expansion may give at most 100,000 patterns, and at most 10,000,000
/// bytes of them altogether, so a pattern with many groups fails instead of
/// exhausting memory.
///
/// # Arguments
///
/// * `count` - How many patterns the expansion would give.
/// * `bytes` - How many bytes those patterns would hold altogether.
///
/// # Returns
///
/// `true` if both are within the limits.
#[must_use]
pub(super) fn brace_output_fits(count: usize, bytes: usize) -> bool {
    count <= MAX_RESULTS && bytes <= MAX_BYTES
}

#[cfg(test)]
mod tests {
    use super::{MAX_BYTES, MAX_RESULTS, brace_output_fits};

    #[test]
    fn accepts_output_at_the_limits() {
        // Arrange
        let count = MAX_RESULTS;

        // Act
        let result = brace_output_fits(count, MAX_BYTES);

        // Assert
        assert!(result);
    }

    #[test]
    fn rejects_too_many_patterns() {
        // Arrange
        let count = MAX_RESULTS + 1;

        // Act
        let result = brace_output_fits(count, 0);

        // Assert
        assert!(!result);
    }

    #[test]
    fn rejects_too_many_bytes() {
        // Arrange
        let bytes = MAX_BYTES + 1;

        // Act
        let result = brace_output_fits(1, bytes);

        // Assert
        assert!(!result);
    }
}
