use super::brace_output_fits::brace_output_fits;
use super::types::BraceExpansionError;

/// Follow each brace expansion result so far with each of a piece's texts.
///
/// The earlier results vary slowest. A single text is appended to every
/// result in place. The size of the combined output is checked with
/// `brace_output_fits` before anything is built.
///
/// # Arguments
///
/// * `results` - The results so far, replaced by the combined results.
/// * `texts` - The texts the next piece of the pattern stands for. Must
///   not be empty.
///
/// # Returns
///
/// Nothing, once `results` has been updated.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the combined output would be
/// too large, leaving `results` as it was.
pub(super) fn combine_brace_texts(
    results: &mut Vec<Vec<u8>>,
    texts: &[Vec<u8>],
) -> Result<(), BraceExpansionError> {
    let result_bytes: usize = results.iter().map(Vec::len).sum();
    let text_bytes: usize = texts.iter().map(Vec::len).sum();
    let count = results.len().saturating_mul(texts.len());
    let bytes = result_bytes
        .saturating_mul(texts.len())
        .saturating_add(text_bytes.saturating_mul(results.len()));
    if !brace_output_fits(count, bytes) {
        return Err(BraceExpansionError::TooManyResults);
    }
    if let [text] = texts {
        for result in results.iter_mut() {
            result.extend_from_slice(text);
        }
        return Ok(());
    }
    *results = results
        .iter()
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
    use super::super::types::BraceExpansionError;
    use super::combine_brace_texts;

    #[test]
    fn appends_a_single_text_to_every_result() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec()]);

        // Assert
        assert_eq!(results, vec![b"ax".to_vec(), b"bx".to_vec()]);
    }

    #[test]
    fn varies_the_earlier_results_slowest() {
        // Arrange
        let mut results = vec![b"a".to_vec(), b"b".to_vec()];

        // Act
        let _ = combine_brace_texts(&mut results, &[b"x".to_vec(), b"y".to_vec()]);

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
    fn rejects_too_many_results() {
        // Arrange
        let mut results = vec![Vec::new(); 1_000];
        let texts = vec![Vec::new(); 1_000];

        // Act
        let result = combine_brace_texts(&mut results, &texts);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn leaves_the_results_alone_when_rejecting() {
        // Arrange
        let mut results = vec![vec![b'a'; 100]; 1_000];
        let texts = vec![vec![b'x'; 100_000]];

        // Act
        let _ = combine_brace_texts(&mut results, &texts);

        // Assert
        assert_eq!(results, vec![vec![b'a'; 100]; 1_000]);
    }
}
