//! Combining expansion results with a piece's texts, within the result limits.

use super::BraceExpansionError;
use super::budget::{BraceBudget, release_brace_budget, take_brace_budget};

/// Follows each brace expansion result so far with each of a piece's texts.
///
/// `results` is replaced by the combined results, with the earlier results varying
/// slowest. `texts`, which must not be empty, are what the next piece stands for,
/// and are already counted in `budget`, the output the whole expansion holds at
/// once. A single text is appended to every result in place; otherwise the old
/// results are consumed one by one as the new ones are built. Before anything is
/// built, the combined results are checked with [`brace_results_fit`] and counted
/// against `budget`; the old results and the texts are released from it
/// afterwards.
///
/// # Errors
///
/// Returns [`BraceExpansionError::TooManyResults`] if the combined results are too
/// large, or don't fit `budget`, leaving `results` and `budget` as they were.
pub(super) fn combine_brace_texts(
    results: &mut Vec<Vec<u8>>,
    texts: &[Vec<u8>],
    budget: &mut BraceBudget,
) -> Result<(), BraceExpansionError> {
    let result_bytes: usize = results.iter().map(Vec::len).sum();
    let text_bytes: usize = texts.iter().map(Vec::len).sum();
    let count = results.len().saturating_mul(texts.len());
    let bytes = result_bytes
        .saturating_mul(texts.len())
        .saturating_add(text_bytes.saturating_mul(results.len()));
    if !brace_results_fit(count, bytes) {
        return Err(BraceExpansionError::TooManyResults);
    }
    if let [text] = texts {
        take_brace_budget(budget, 0, bytes - result_bytes)?;
        for result in results.iter_mut() {
            result.extend_from_slice(text);
        }
        release_brace_budget(budget, texts);
        return Ok(());
    }
    take_brace_budget(budget, count, bytes)?;
    let old = std::mem::take(results);
    release_brace_budget(budget, &old);
    release_brace_budget(budget, texts);
    *results = old
        .into_iter()
        .flat_map(|prefix| {
            texts
                .iter()
                .map(move |text| [prefix.as_slice(), text].concat())
        })
        .collect();
    Ok(())
}

/// The most patterns one brace expansion may give.
pub(super) const MAX_RESULTS: usize = 100_000;

/// The most bytes, across all its patterns, one brace expansion may give.
pub(super) const MAX_RESULT_BYTES: usize = 10_000_000;

/// Checks whether a set of brace expansion results is within the limits.
///
/// The set holds `count` patterns of `bytes` bytes altogether, and fits when
/// those are at most [`MAX_RESULTS`] and [`MAX_RESULT_BYTES`]: 100,000 patterns
/// and 10,000,000 bytes. Every set of results built during an expansion becomes
/// part of the final output, so checking each set as it's built refuses exactly
/// the expansions whose final output would be too large, whatever order their
/// groups come in.
#[must_use]
fn brace_results_fit(count: usize, bytes: usize) -> bool {
    count <= MAX_RESULTS && bytes <= MAX_RESULT_BYTES
}

#[cfg(test)]
mod tests {
    use super::super::BraceExpansionError;
    use super::super::budget::{BraceBudget, MAX_HELD, MAX_HELD_BYTES};
    use super::{MAX_RESULT_BYTES, MAX_RESULTS, brace_results_fit, combine_brace_texts};

    #[test]
    fn appends_a_single_text_to_every_result() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget { count: 3, bytes: 3 };

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec()], &mut budget);

        // Assert
        assert_eq!(results, vec![b"ax".to_vec(), b"bx".to_vec()]);
    }

    #[test]
    fn counts_an_appended_text_once_per_result() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget { count: 3, bytes: 3 };

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec()], &mut budget);

        // Assert
        assert_eq!(budget, BraceBudget { count: 2, bytes: 4 });
    }

    #[test]
    fn varies_the_earlier_results_slowest() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget { count: 4, bytes: 4 };

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec(), b"y".to_vec()], &mut budget);

        // Assert
        assert_eq!(
            results,
            vec![
                b"ax".to_vec(),
                b"ay".to_vec(),
                b"bx".to_vec(),
                b"by".to_vec()
            ]
        );
    }

    #[test]
    fn counts_only_the_combined_results_afterwards() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget { count: 4, bytes: 4 };

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec(), b"y".to_vec()], &mut budget);

        // Assert
        assert_eq!(budget, BraceBudget { count: 4, bytes: 8 });
    }

    #[test]
    fn accepts_combined_results_exactly_at_the_limit() {
        // Arrange
        let mut results = vec![Vec::new(); 10_000];
        let texts = vec![Vec::new(); 10];
        let mut budget = BraceBudget {
            count: 10_010,
            bytes: 0,
        };

        // Act
        let result = combine_brace_texts(&mut results, &texts, &mut budget);

        // Assert
        assert_eq!(result, Ok(()));
    }

    #[test]
    fn rejects_too_many_combined_results() {
        // Arrange
        let mut results = vec![Vec::new(); 1_000];
        let texts = vec![Vec::new(); 101];
        let mut budget = BraceBudget {
            count: 1_101,
            bytes: 0,
        };

        // Act
        let result = combine_brace_texts(&mut results, &texts, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_an_appended_text_that_makes_the_results_too_large() {
        // Arrange
        let mut results = vec![vec![b'a'; 100]; 1_000];
        let texts = vec![vec![b'x'; 10_000]];
        let mut budget = BraceBudget {
            count: 1_001,
            bytes: 110_000,
        };

        // Act
        let result = combine_brace_texts(&mut results, &texts, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_combined_results_that_do_not_fit_the_budget() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget {
            count: MAX_HELD - 1,
            bytes: 4,
        };

        // Act
        let result =
            combine_brace_texts(&mut results, &[b"x".to_vec(), b"y".to_vec()], &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_an_appended_text_that_does_not_fit_the_budget() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget {
            count: 3,
            bytes: MAX_HELD_BYTES - 1,
        };

        // Act
        let result = combine_brace_texts(&mut results, &[b"x".to_vec()], &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn leaves_the_results_and_budget_alone_when_rejecting() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];
        let mut budget = BraceBudget {
            count: MAX_HELD - 1,
            bytes: 4,
        };

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec(), b"y".to_vec()], &mut budget);

        // Assert
        assert_eq!(
            (results, budget),
            (
                vec![b"a".to_vec(), b"b".to_vec()],
                BraceBudget {
                    count: MAX_HELD - 1,
                    bytes: 4
                }
            )
        );
    }

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
