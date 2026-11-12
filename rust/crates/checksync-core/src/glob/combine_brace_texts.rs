use super::release_brace_budget::release_brace_budget;
use super::take_brace_budget::take_brace_budget;
use super::types::{BraceBudget, BraceExpansionError};

/// Follow each brace expansion result so far with each of a piece's texts.
///
/// The earlier results vary slowest. A single text is appended to every
/// result in place; otherwise the old results are consumed one by one as
/// the new ones are built. The new output is counted against `budget`
/// before anything is built, and the old results and the texts are then
/// released from it.
///
/// # Arguments
///
/// * `results` - The results so far, replaced by the combined results.
/// * `texts` - The texts the next piece stands for, already counted in
///   `budget`. Must not be empty.
/// * `budget` - The output the whole expansion holds at once.
///
/// # Returns
///
/// Nothing, once `results` has been updated.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the combined output wouldn't
/// fit, leaving `results` as it was.
pub(super) fn combine_brace_texts(
    results: &mut Vec<Vec<u8>>,
    texts: &[Vec<u8>],
    budget: &mut BraceBudget,
) -> Result<(), BraceExpansionError> {
    if let [text] = texts {
        take_brace_budget(budget, 0, text.len().saturating_mul(results.len()))?;
        for result in results.iter_mut() {
            result.extend_from_slice(text);
        }
        release_brace_budget(budget, texts);
        return Ok(());
    }
    let result_bytes: usize = results.iter().map(Vec::len).sum();
    let text_bytes: usize = texts.iter().map(Vec::len).sum();
    let count = results.len().saturating_mul(texts.len());
    let bytes = result_bytes
        .saturating_mul(texts.len())
        .saturating_add(text_bytes.saturating_mul(results.len()));
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

#[cfg(test)]
mod tests {
    use super::super::types::{BraceBudget, BraceExpansionError};
    use super::combine_brace_texts;

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
    fn rejects_too_many_combined_results() {
        // Arrange
        let mut results = vec![Vec::new(); 1_000];
        let texts = vec![Vec::new(); 1_000];
        let mut budget = BraceBudget {
            count: 2_000,
            bytes: 0,
        };

        // Act
        let result = combine_brace_texts(&mut results, &texts, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_an_appended_text_that_does_not_fit() {
        // Arrange
        let mut results = vec![vec![b'a'; 100]; 1_000];
        let texts = vec![vec![b'x'; 100_000]];
        let mut budget = BraceBudget {
            count: 1_001,
            bytes: 200_000,
        };

        // Act
        let result = combine_brace_texts(&mut results, &texts, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
