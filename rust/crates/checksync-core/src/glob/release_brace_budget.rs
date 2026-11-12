use super::types::BraceBudget;

/// Stop counting output a brace expansion no longer holds.
///
/// # Arguments
///
/// * `budget` - The output held so far, reduced by the released output.
/// * `patterns` - The patterns no longer held.
pub(super) fn release_brace_budget(budget: &mut BraceBudget, patterns: &[Vec<u8>]) {
    let bytes: usize = patterns.iter().map(Vec::len).sum();
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

    #[test]
    fn does_not_go_below_zero() {
        // Arrange
        let mut budget = BraceBudget { count: 1, bytes: 1 };

        // Act
        release_brace_budget(&mut budget, &[b"ab".to_vec(), b"c".to_vec()]);

        // Assert
        assert_eq!(budget, BraceBudget::default());
    }
}
