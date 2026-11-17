//! Expanding brace groups step by step, with the work kept on a heap stack.

use super::BraceExpansionError;
use super::budget::{BraceBudget, take_brace_budget};
use super::combine::combine_brace_texts;
use super::group::{BracePiece, next_brace_piece};

/// A step of brace expansion still in progress, kept on a heap stack.
#[derive(Debug, Clone, PartialEq, Eq)]
enum BraceFrame {
    /// Expanding a run of the pattern piece by piece.
    Sequence {
        /// The index just past the end of the run.
        end: usize,
        /// Where the next piece starts.
        index: usize,
        /// The expanded patterns so far.
        results: Vec<Vec<u8>>,
    },
    /// Expanding a group's alternatives one after another.
    ///
    /// It holds the state of the run it's in, which carries on once the group's
    /// alternatives are all expanded.
    Group {
        /// Where each alternative lies in the pattern.
        alternatives: Vec<std::ops::Range<usize>>,
        /// Which alternative to expand next.
        next: usize,
        /// The expanded alternatives so far, in order.
        texts: Vec<Vec<u8>>,
        /// The run's expanded patterns before the group.
        results: Vec<Vec<u8>>,
        /// The index just past the end of the run.
        end: usize,
        /// The index just past the group, where the run carries on.
        resume: usize,
    },
}

/// Expands a pattern's brace groups with a heap stack, within a budget.
///
/// [`expand_braces`] checks the pattern's length first. Nested groups are
/// expanded through frames on a stack kept on the heap rather than through
/// recursion, so the call stack stays the same size whatever the input. Returns
/// the expanded patterns, in order; they stay counted in `budget`, the output the
/// whole expansion holds at once, until the caller releases them.
///
/// # Errors
///
/// Returns [`BraceExpansionError::TooManyResults`] if the output doesn't fit.
///
/// [`expand_braces`]: super::expand_braces
pub(super) fn expand_brace_pieces(
    pattern: &[u8],
    budget: &mut BraceBudget,
) -> Result<Vec<Vec<u8>>, BraceExpansionError> {
    let mut stack = vec![start_brace_sequence(0..pattern.len(), budget)?];
    let mut expanded = Vec::new();
    // The stack empties just after the step that finishes the expansion.
    while let Some(frame) = stack.pop() {
        if let Some(results) = step_brace_frame(pattern, frame, &mut stack, budget)? {
            expanded = results;
        }
    }
    Ok(expanded)
}

/// Takes one step of brace expansion on the frame popped from the stack.
///
/// `frame` is the frame popped from the top of the stack, `stack` holds the
/// frames below it, which this step may push onto, and `budget` is the output the
/// whole expansion holds at once. A run with pieces left reads the next one of
/// `pattern`: text is appended to its results, and a group takes over the run's
/// state while its alternatives are expanded. A group with alternatives left
/// pushes a run for the next one. A finished run hands its results to the group
/// below it, or, with nothing below it, is the whole expansion. A finished group
/// combines its texts into the run's results, and the run carries on after the
/// group. Nothing recurses, so the call stack stays the same size however deeply
/// groups nest.
///
/// Returns the expanded patterns if this step finished the whole expansion, or
/// `None` if there's more to do.
///
/// # Errors
///
/// Returns [`BraceExpansionError::TooManyResults`] if the output doesn't fit.
fn step_brace_frame(
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

/// Returns a frame that starts expanding a run of a pattern.
///
/// The run is where `run` lies in the pattern, and the frame starts with one
/// empty result so far, which `budget`, the output the whole expansion holds at
/// once, gains.
///
/// # Errors
///
/// Returns [`BraceExpansionError::TooManyResults`] if the empty result doesn't
/// fit.
fn start_brace_sequence(
    run: std::ops::Range<usize>,
    budget: &mut BraceBudget,
) -> Result<BraceFrame, BraceExpansionError> {
    take_brace_budget(budget, 1, 0)?;
    Ok(BraceFrame::Sequence {
        end: run.end,
        index: run.start,
        results: vec![Vec::new()],
    })
}

#[cfg(test)]
mod tests {
    use super::super::BraceExpansionError;
    use super::super::budget::{BraceBudget, MAX_HELD, MAX_HELD_BYTES};
    use super::{BraceFrame, expand_brace_pieces, step_brace_frame};

    #[test]
    fn combines_the_pieces_in_order() {
        // Arrange
        let pattern = b"a{b,c}d";

        // Act
        let result = expand_brace_pieces(pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Ok(vec![b"abd".to_vec(), b"acd".to_vec()]));
    }

    #[test]
    fn expands_nested_groups() {
        // Arrange
        let pattern = b"x{a,b{c,d}}y";

        // Act
        let result = expand_brace_pieces(pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(
            result,
            Ok(vec![b"xay".to_vec(), b"xbcy".to_vec(), b"xbdy".to_vec()])
        );
    }

    #[test]
    fn gives_an_empty_pattern_for_an_empty_pattern() {
        // Arrange
        let pattern = b"";

        // Act
        let result = expand_brace_pieces(pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Ok(vec![Vec::new()]));
    }

    #[test]
    fn leaves_only_the_results_counted() {
        // Arrange
        let mut budget = BraceBudget::default();

        // Act
        let _ = expand_brace_pieces(b"a{b,c}d", &mut budget);

        // Assert
        assert_eq!(budget, BraceBudget { count: 2, bytes: 6 });
    }

    #[test]
    fn rejects_a_start_that_does_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_HELD,
            bytes: 0,
        };

        // Act
        let result = expand_brace_pieces(b"", &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_combined_results_that_do_not_fit() {
        // Arrange
        let pattern = b"{a,b}".repeat(17);

        // Act
        let result = expand_brace_pieces(&pattern, &mut BraceBudget::default());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn counts_the_output_held_by_enclosing_groups() {
        // Arrange
        let inner = b"{c,d}".repeat(4);
        let pattern = [b"{".as_slice(), &b"{a,b}".repeat(4), b",", &inner, b"}"].concat();
        let room_for_inner = (0..MAX_HELD)
            .find(|room| {
                let mut budget = BraceBudget {
                    count: MAX_HELD - room,
                    bytes: 0,
                };
                expand_brace_pieces(&inner, &mut budget).is_ok()
            })
            .unwrap();
        let mut budget = BraceBudget {
            count: MAX_HELD - room_for_inner,
            bytes: 0,
        };

        // Act
        let result = expand_brace_pieces(&pattern, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    /// Returns a budget that already counts more than any frame in these tests holds.
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

#[cfg(test)]
mod start_brace_sequence_tests {
    use super::super::BraceExpansionError;
    use super::super::budget::{BraceBudget, MAX_HELD};
    use super::{BraceFrame, start_brace_sequence};

    #[test]
    fn starts_with_one_empty_result() {
        // Arrange
        let mut budget = BraceBudget::default();

        // Act
        let result = start_brace_sequence(2..5, &mut budget);

        // Assert
        assert_eq!(
            result,
            Ok(BraceFrame::Sequence {
                end: 5,
                index: 2,
                results: vec![Vec::new()],
            })
        );
    }

    #[test]
    fn counts_the_empty_result() {
        // Arrange
        let mut budget = BraceBudget::default();

        // Act
        let _ = start_brace_sequence(0..1, &mut budget);

        // Assert
        assert_eq!(budget, BraceBudget { count: 1, bytes: 0 });
    }

    #[test]
    fn rejects_a_start_that_does_not_fit() {
        // Arrange
        let mut budget = BraceBudget {
            count: MAX_HELD,
            bytes: 0,
        };

        // Act
        let result = start_brace_sequence(0..1, &mut budget);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }
}
