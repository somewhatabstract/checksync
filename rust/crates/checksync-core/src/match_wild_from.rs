use crate::byte_at::byte_at;
use crate::fold_byte::fold_byte;
use crate::match_bracket_class::match_bracket_class;
use crate::match_star::match_star;
use crate::types::{BracketClassMatch, StarStep, WildmatchInput, WildmatchOutcome};

/// Match a pattern against text, each from a given index on.
///
/// This walks the pattern and text together, as git's `dowild` does: `\`
/// escapes the next byte, `?` matches any byte (except `/` with
/// `pathname`), `[` starts a bracket class, a run of `*` is handed to
/// `match_star`, and any other byte must match itself.
///
/// # Arguments
///
/// * `input` - The pattern, text and matching options.
/// * `start` - Where to start in the pattern.
/// * `text_index` - Where to start in the text.
///
/// # Returns
///
/// How the attempt ended.
#[must_use]
pub(crate) fn match_wild_from(
    input: WildmatchInput<'_>,
    start: usize,
    text_index: usize,
) -> WildmatchOutcome {
    let mut p = start;
    let mut t = text_index;
    loop {
        let p_ch = byte_at(input.pattern, p);
        if p_ch == 0 {
            break;
        }
        let raw_t_ch = byte_at(input.text, t);
        if raw_t_ch == 0 && p_ch != b'*' {
            return WildmatchOutcome::Abort;
        }
        let t_ch = fold_byte(raw_t_ch, input.casefold);
        match fold_byte(p_ch, input.casefold) {
            b'\\' => {
                // The escaped byte isn't lowercased, as in git.
                p += 1;
                if t_ch != byte_at(input.pattern, p) {
                    return WildmatchOutcome::NoMatch;
                }
            }
            b'?' => {
                if input.pathname && t_ch == b'/' {
                    return WildmatchOutcome::NoMatch;
                }
            }
            b'*' => match match_star(input, start, p + 1, t) {
                StarStep::Done(outcome) => return outcome,
                StarStep::Continue {
                    pattern_index,
                    text_index,
                } => {
                    p = pattern_index;
                    t = text_index;
                }
            },
            b'[' => {
                match match_bracket_class(input.pattern, p, t_ch, input.casefold, input.pathname) {
                    BracketClassMatch::Matched { close } => p = close,
                    BracketClassMatch::NoMatch => return WildmatchOutcome::NoMatch,
                    BracketClassMatch::Abort => return WildmatchOutcome::Abort,
                }
            }
            literal => {
                if t_ch != literal {
                    return WildmatchOutcome::NoMatch;
                }
            }
        }
        p += 1;
        t += 1;
    }
    if byte_at(input.text, t) == 0 {
        WildmatchOutcome::Match
    } else {
        WildmatchOutcome::NoMatch
    }
}

#[cfg(test)]
mod tests {
    use super::match_wild_from;
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
    fn matches_from_the_given_indexes() {
        // Arrange
        let (pattern, text) = (b"xab", b"yab");

        // Act
        let result = match_wild_from(input(pattern, text), 1, 1);

        // Assert
        assert_eq!(result, WildmatchOutcome::Match);
    }

    #[test]
    fn does_not_match_a_different_literal() {
        // Arrange
        let (pattern, text) = (b"ab", b"ac");

        // Act
        let result = match_wild_from(input(pattern, text), 0, 0);

        // Assert
        assert_eq!(result, WildmatchOutcome::NoMatch);
    }

    #[test]
    fn stops_trying_when_the_text_ends_before_the_pattern() {
        // Arrange
        let (pattern, text) = (b"abc", b"ab");

        // Act
        let result = match_wild_from(input(pattern, text), 0, 0);

        // Assert
        assert_eq!(result, WildmatchOutcome::Abort);
    }

    #[test]
    fn does_not_match_when_the_pattern_ends_before_the_text() {
        // Arrange
        let (pattern, text) = (b"ab", b"abc");

        // Act
        let result = match_wild_from(input(pattern, text), 0, 0);

        // Assert
        assert_eq!(result, WildmatchOutcome::NoMatch);
    }

    #[test]
    fn carries_on_after_a_star_that_ends_a_folder_name() {
        // Arrange
        let (pattern, text) = (b"*/b", b"a/b");

        // Act
        let result = match_wild_from(input(pattern, text), 0, 0);

        // Assert
        assert_eq!(result, WildmatchOutcome::Match);
    }

    #[test]
    fn passes_on_how_a_star_ended() {
        // Arrange
        let (pattern, text) = (b"*", b"a/b");

        // Act
        let result = match_wild_from(input(pattern, text), 0, 0);

        // Assert
        assert_eq!(result, WildmatchOutcome::AbortToDoubleStar);
    }

    #[test]
    fn stops_trying_after_a_malformed_bracket_class() {
        // Arrange
        let (pattern, text) = (b"[a", b"a");

        // Act
        let result = match_wild_from(input(pattern, text), 0, 0);

        // Assert
        assert_eq!(result, WildmatchOutcome::Abort);
    }
}
