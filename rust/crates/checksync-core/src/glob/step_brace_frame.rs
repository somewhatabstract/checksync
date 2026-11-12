use super::combine_brace_texts::combine_brace_texts;
use super::next_brace_piece::next_brace_piece;
use super::start_brace_sequence::start_brace_sequence;
use super::take_brace_budget::take_brace_budget;
use super::types::{BraceBudget, BraceExpansionError, BraceFrame, BracePiece};

/// Take one step of brace expansion on the frame popped from the stack.
///
/// A run with pieces left reads the next one: text is appended to its
/// results, and a group takes over the run's state while its alternatives
/// are expanded. A group with alternatives left pushes a run for the next
/// one. A finished run hands its results to the group below it, or, with
/// nothing below it, is the whole expansion. A finished group combines its
/// texts into the run's results, and the run carries on after the group.
/// Nothing recurses, so the call stack stays the same size however deeply
/// groups nest.
///
/// # Arguments
///
/// * `pattern` - The whole pattern.
/// * `frame` - The frame popped from the top of the stack.
/// * `stack` - The frames below it, which this step may push onto.
/// * `budget` - The output the whole expansion holds at once.
///
/// # Returns
///
/// The expanded patterns if this step finished the whole expansion, or
/// `None` if there's more to do.
///
/// # Errors
///
/// `BraceExpansionError::TooManyResults` if the output doesn't fit.
pub(super) fn step_brace_frame(
    pattern: &[u8],
    frame: BraceFrame,
    stack: &mut Vec<BraceFrame>,
    budget: &mut BraceBudget,
) -> Result<Option<Vec<Vec<u8>>>, BraceExpansionError> {
    match frame {
        BraceFrame::Sequence {
            end,
            index,
            mut results,
        } if index < end => match next_brace_piece(&pattern[..end], index) {
            BracePiece::Text(next) => {
                take_brace_budget(budget, 1, next - index)?;
                combine_brace_texts(&mut results, &[pattern[index..next].to_vec()], budget)?;
                stack.push(BraceFrame::Sequence {
                    end,
                    index: next,
                    results,
                });
            }
            BracePiece::Group(group) => stack.push(BraceFrame::Group {
                alternatives: group.alternatives,
                next: 0,
                texts: Vec::new(),
                results,
                end,
                resume: group.end,
            }),
        },
        BraceFrame::Sequence { results, .. } => match stack.last_mut() {
            Some(BraceFrame::Group { texts, .. }) => texts.extend(results),
            _ => return Ok(Some(results)),
        },
        BraceFrame::Group {
            alternatives,
            next,
            texts,
            results,
            end,
            resume,
        } if next < alternatives.len() => {
            let alternative = alternatives[next].clone();
            stack.push(BraceFrame::Group {
                alternatives,
                next: next + 1,
                texts,
                results,
                end,
                resume,
            });
            stack.push(start_brace_sequence(alternative, budget)?);
        }
        BraceFrame::Group {
            texts,
            mut results,
            end,
            resume,
            ..
        } => {
            combine_brace_texts(&mut results, &texts, budget)?;
            stack.push(BraceFrame::Sequence {
                end,
                index: resume,
                results,
            });
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::super::take_brace_budget::{MAX_HELD, MAX_HELD_BYTES};
    use super::super::types::{BraceBudget, BraceExpansionError, BraceFrame};
    use super::step_brace_frame;

    /// A budget that already counts more than any frame in these tests holds.
    fn counted() -> BraceBudget {
        BraceBudget {
            count: 100,
            bytes: 100,
        }
    }

    fn sequence(end: usize, index: usize, results: &[&[u8]]) -> BraceFrame {
        BraceFrame::Sequence {
            end,
            index,
            results: results.iter().map(|result| result.to_vec()).collect(),
        }
    }

    fn group(next: usize, texts: &[&[u8]]) -> BraceFrame {
        BraceFrame::Group {
            alternatives: vec![1..2, 3..4],
            next,
            texts: texts.iter().map(|text| text.to_vec()).collect(),
            results: vec![b"x".to_vec()],
            end: 6,
            resume: 5,
        }
    }

    #[test]
    fn appends_text_to_a_sequence() {
        // Arrange
        let mut stack = Vec::new();

        // Act
        let _ = step_brace_frame(
            b"ab{c,d}",
            sequence(7, 0, &[b"x"]),
            &mut stack,
            &mut counted(),
        );

        // Assert
        assert_eq!(stack, vec![sequence(7, 2, &[b"xab"])]);
    }

    #[test]
    fn hands_a_sequence_over_to_a_group() {
        // Arrange
        let mut stack = Vec::new();

        // Act
        let _ = step_brace_frame(
            b"{c,d}e",
            sequence(6, 0, &[b"x"]),
            &mut stack,
            &mut counted(),
        );

        // Assert
        assert_eq!(stack, vec![group(0, &[])]);
    }

    #[test]
    fn pushes_a_sequence_for_the_next_alternative() {
        // Arrange
        let mut stack = Vec::new();

        // Act
        let _ = step_brace_frame(b"{c,d}e", group(1, &[b"c"]), &mut stack, &mut counted());

        // Assert
        assert_eq!(stack, vec![group(2, &[b"c"]), sequence(4, 3, &[b""])]);
    }

    #[test]
    fn hands_a_finished_sequence_to_its_group() {
        // Arrange
        let mut stack = vec![group(2, &[b"c"])];

        // Act
        let _ = step_brace_frame(
            b"{c,d}e",
            sequence(4, 4, &[b"d"]),
            &mut stack,
            &mut counted(),
        );

        // Assert
        assert_eq!(stack, vec![group(2, &[b"c", b"d"])]);
    }

    #[test]
    fn carries_on_the_sequence_after_a_finished_group() {
        // Arrange
        let mut stack = Vec::new();

        // Act
        let _ = step_brace_frame(
            b"{c,d}e",
            group(2, &[b"c", b"d"]),
            &mut stack,
            &mut counted(),
        );

        // Assert
        assert_eq!(stack, vec![sequence(6, 5, &[b"xc", b"xd"])]);
    }

    #[test]
    fn has_more_to_do_after_an_ordinary_step() {
        // Arrange
        let mut stack = Vec::new();

        // Act
        let result = step_brace_frame(b"ab", sequence(2, 0, &[b""]), &mut stack, &mut counted());

        // Assert
        assert_eq!(result, Ok(None));
    }

    #[test]
    fn finishes_with_the_results_of_the_last_sequence() {
        // Arrange
        let mut stack = Vec::new();

        // Act
        let result = step_brace_frame(b"ab", sequence(2, 2, &[b"ab"]), &mut stack, &mut counted());

        // Assert
        assert_eq!(result, Ok(Some(vec![b"ab".to_vec()])));
    }

    #[test]
    fn rejects_text_that_does_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_HELD,
            bytes: 0,
        };

        // Act
        let result = step_brace_frame(b"ab", sequence(2, 0, &[b""]), &mut Vec::new(), &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_text_whose_combined_results_do_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: 1,
            bytes: MAX_HELD_BYTES - 3,
        };

        // Act
        let result = step_brace_frame(b"ab", sequence(2, 0, &[b""]), &mut Vec::new(), &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_an_alternative_that_does_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_HELD,
            bytes: 0,
        };

        // Act
        let result = step_brace_frame(b"{c,d}e", group(0, &[]), &mut Vec::new(), &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_a_group_whose_combined_results_do_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_HELD,
            bytes: 0,
        };

        // Act
        let result = step_brace_frame(
            b"{c,d}e",
            group(2, &[b"c", b"d"]),
            &mut Vec::new(),
            &mut budget,
        );

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
