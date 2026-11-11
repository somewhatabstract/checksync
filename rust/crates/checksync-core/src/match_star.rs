use crate::byte_at::byte_at;
use crate::find_slash::find_slash;
use crate::match_wild_from::match_wild_from;
use crate::read_star_run::read_star_run;
use crate::try_star_start_points::try_star_start_points;
use crate::types::{StarStep, WildmatchInput, WildmatchOutcome};

/// Match a run of `*` in a pattern, and the rest of the pattern after it.
///
/// A `**` that makes up a whole folder name may match no folders at all, so
/// `a/**/b` also matches `a/b`. A run that ends the pattern matches the rest
/// of the text, or just the rest of the folder name when it can't match
/// `/`. A run that can't match `/` and comes before one matches the rest of
/// the folder name, and matching carries on from the `/`. Anything else
/// tries each place the run could stop.
///
/// # Arguments
///
/// * `input` - The pattern, text and matching options.
/// * `start` - The index where the current match attempt began.
/// * `after_star` - The index just after the run's first `*`.
/// * `text_index` - Where the run begins in the text.
///
/// # Returns
///
/// Either the outcome of the match attempt, or where to carry on matching.
#[must_use]
pub(crate) fn match_star(
    input: WildmatchInput<'_>,
    start: usize,
    after_star: usize,
    text_index: usize,
) -> StarStep {
    let run = read_star_run(input.pattern, after_star, start, input.pathname);
    let next = byte_at(input.pattern, run.next);
    if run.whole_folder
        && next == b'/'
        && match_wild_from(input, run.next + 1, text_index) == WildmatchOutcome::Match
    {
        return StarStep::Done(WildmatchOutcome::Match);
    }
    if next == 0 {
        let crosses_folder = !run.match_slash && find_slash(input.text, text_index).is_some();
        return StarStep::Done(if crosses_folder {
            WildmatchOutcome::AbortToDoubleStar
        } else {
            WildmatchOutcome::Match
        });
    }
    if !run.match_slash && next == b'/' {
        return match find_slash(input.text, text_index) {
            Some(slash) => StarStep::Continue {
                pattern_index: run.next,
                text_index: slash,
            },
            None => StarStep::Done(WildmatchOutcome::Abort),
        };
    }
    StarStep::Done(try_star_start_points(
        input,
        run.next,
        text_index,
        run.match_slash,
    ))
}

#[cfg(test)]
mod tests {
    use super::match_star;
    use crate::types::{StarStep, WildmatchInput, WildmatchOutcome};

    fn input<'a>(pattern: &'a [u8], text: &'a [u8]) -> WildmatchInput<'a> {
        WildmatchInput {
            pattern,
            text,
            pathname: true,
            casefold: false,
        }
    }

    #[test]
    fn lets_a_whole_folder_double_star_match_no_folders() {
        // Arrange
        let (pattern, text) = (b"a/**/b", b"a/b");

        // Act
        let result = match_star(input(pattern, text), 0, 3, 2);

        // Assert
        assert_eq!(result, StarStep::Done(WildmatchOutcome::Match));
    }

    #[test]
    fn matches_the_rest_of_the_text_with_a_trailing_double_star() {
        // Arrange
        let (pattern, text) = (b"a/**", b"a/b/c");

        // Act
        let result = match_star(input(pattern, text), 0, 3, 2);

        // Assert
        assert_eq!(result, StarStep::Done(WildmatchOutcome::Match));
    }

    #[test]
    fn matches_the_rest_of_the_folder_name_with_a_trailing_star() {
        // Arrange
        let (pattern, text) = (b"a/*", b"a/bc");

        // Act
        let result = match_star(input(pattern, text), 0, 3, 2);

        // Assert
        assert_eq!(result, StarStep::Done(WildmatchOutcome::Match));
    }

    #[test]
    fn leaves_later_folders_to_a_double_star_for_a_trailing_star() {
        // Arrange
        let (pattern, text) = (b"a/*", b"a/b/c");

        // Act
        let result = match_star(input(pattern, text), 0, 3, 2);

        // Assert
        assert_eq!(result, StarStep::Done(WildmatchOutcome::AbortToDoubleStar));
    }

    #[test]
    fn carries_on_from_the_slash_after_a_star_that_ends_a_folder_name() {
        // Arrange
        let (pattern, text) = (b"*/b", b"ab/b");

        // Act
        let result = match_star(input(pattern, text), 0, 1, 0);

        // Assert
        assert_eq!(
            result,
            StarStep::Continue {
                pattern_index: 1,
                text_index: 2
            }
        );
    }

    #[test]
    fn stops_when_a_star_before_a_slash_finds_no_slash() {
        // Arrange
        let (pattern, text) = (b"*/b", b"ab");

        // Act
        let result = match_star(input(pattern, text), 0, 1, 0);

        // Assert
        assert_eq!(result, StarStep::Done(WildmatchOutcome::Abort));
    }

    #[test]
    fn tries_each_place_the_star_could_stop_otherwise() {
        // Arrange
        let (pattern, text) = (b"*b", b"aab");

        // Act
        let result = match_star(input(pattern, text), 0, 1, 0);

        // Assert
        assert_eq!(result, StarStep::Done(WildmatchOutcome::Match));
    }
}
