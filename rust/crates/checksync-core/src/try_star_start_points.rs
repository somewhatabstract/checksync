use crate::byte_at::byte_at;
use crate::fold_byte::fold_byte;
use crate::match_wild_from::match_wild_from;
use crate::skip_to_literal::skip_to_literal;
use crate::types::{WildmatchInput, WildmatchOutcome};

/// Try each place a `*` could stop, matching the rest of the pattern after it.
///
/// Starting where the `*` began in the text, this tries the rest of the
/// pattern at each later point until one matches or no later point can.
/// When the rest starts with a literal byte, it skips straight to the next
/// place the text has that byte. Unless the `*` can match `/`, it stops at
/// the end of the folder name, and leaves any enclosing `**` to try further
/// on.
///
/// # Arguments
///
/// * `input` - The pattern, text and matching options.
/// * `pattern_index` - The index of the pattern byte after the `*`.
/// * `text_index` - Where the `*` began in the text.
/// * `match_slash` - Whether the `*` can match `/`.
///
/// # Returns
///
/// How the attempt ended.
#[must_use]
pub(crate) fn try_star_start_points(
    input: WildmatchInput<'_>,
    pattern_index: usize,
    text_index: usize,
    match_slash: bool,
) -> WildmatchOutcome {
    let next = byte_at(input.pattern, pattern_index);
    let literal =
        (!matches!(next, b'*' | b'?' | b'[' | b'\\')).then(|| fold_byte(next, input.casefold));
    let mut t = text_index;
    while byte_at(input.text, t) != 0 {
        if let Some(wanted) = literal {
            match skip_to_literal(input, t, wanted, match_slash) {
                Some(found) => t = found,
                None if match_slash => return WildmatchOutcome::Abort,
                None => return WildmatchOutcome::AbortToDoubleStar,
            }
        }
        let matched = match_wild_from(input, pattern_index, t);
        if matched != WildmatchOutcome::NoMatch {
            if !match_slash || matched != WildmatchOutcome::AbortToDoubleStar {
                return matched;
            }
        } else if !match_slash && byte_at(input.text, t) == b'/' {
            return WildmatchOutcome::AbortToDoubleStar;
        }
        t += 1;
    }
    WildmatchOutcome::Abort
}

#[cfg(test)]
mod tests {
    use super::try_star_start_points;
    use crate::types::{WildmatchInput, WildmatchOutcome};

    fn input<'a>(pattern: &'a [u8], text: &'a [u8]) -> WildmatchInput<'a> {
        WildmatchInput {
            pattern,
            text,
            pathname: true,
            casefold: false,
        }
    }

    #[test]
    fn matches_at_a_later_point() {
        // Arrange
        let (pattern, text) = (b"*b", b"aab");

        // Act
        let result = try_star_start_points(input(pattern, text), 1, 0, false);

        // Assert
        assert_eq!(result, WildmatchOutcome::Match);
    }

    #[test]
    fn tries_another_point_after_one_that_does_not_match() {
        // Arrange
        let (pattern, text) = (b"*bc", b"abxbc");

        // Act
        let result = try_star_start_points(input(pattern, text), 1, 0, false);

        // Assert
        assert_eq!(result, WildmatchOutcome::Match);
    }

    #[test]
    fn leaves_later_folders_to_a_double_star_when_a_literal_is_not_in_this_one() {
        // Arrange
        let (pattern, text) = (b"*b", b"a/b");

        // Act
        let result = try_star_start_points(input(pattern, text), 1, 0, false);

        // Assert
        assert_eq!(result, WildmatchOutcome::AbortToDoubleStar);
    }

    #[test]
    fn stops_trying_when_a_star_that_crosses_slashes_cannot_find_a_literal() {
        // Arrange
        let (pattern, text) = (b"*b", b"a/c");

        // Act
        let result = try_star_start_points(input(pattern, text), 1, 0, true);

        // Assert
        assert_eq!(result, WildmatchOutcome::Abort);
    }

    #[test]
    fn leaves_later_folders_to_a_double_star_when_a_wildcard_reaches_a_slash() {
        // Arrange
        let (pattern, text) = (b"*?b", b"a/xb");

        // Act
        let result = try_star_start_points(input(pattern, text), 1, 0, false);

        // Assert
        assert_eq!(result, WildmatchOutcome::AbortToDoubleStar);
    }

    #[test]
    fn keeps_trying_past_an_inner_double_star_abort_when_crossing_slashes() {
        // Arrange
        let (pattern, text) = (b"**/x*b", b"xa/xb");

        // Act
        let result = try_star_start_points(input(pattern, text), 3, 0, true);

        // Assert
        assert_eq!(result, WildmatchOutcome::Match);
    }

    #[test]
    fn stops_trying_at_the_end_of_the_text() {
        // Arrange
        let (pattern, text) = (b"*?b", b"a");

        // Act
        let result = try_star_start_points(input(pattern, text), 1, 0, false);

        // Assert
        assert_eq!(result, WildmatchOutcome::Abort);
    }
}
