use super::types::BraceBudget;

/// Stop counting output a brace expansion no longer holds.
///
/// Debug builds check that the budget covers the released output, which
/// catches output released twice; release builds stop at zero instead.
///
/// # Arguments
///
/// * `budget` - The output held so far, reduced by the released output.
/// * `patterns` - The patterns no longer held.
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
    use super::super::types::BraceBudget;
    use super::release_brace_budget;

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
