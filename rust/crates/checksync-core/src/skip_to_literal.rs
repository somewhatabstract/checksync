use crate::byte_at::byte_at;
use crate::fold_byte::fold_byte;
use crate::types::WildmatchInput;

/// Find the next place a `*` could stop, before the literal byte after it.
///
/// A `*` followed by a literal byte can only stop where the text has that
/// byte, so the text is searched for it. Unless the `*` can match `/`, the
/// search stops at the end of the folder name.
///
/// # Arguments
///
/// * `input` - The pattern, text and matching options.
/// * `text_index` - Where to start searching the text.
/// * `wanted` - The literal byte, already folded if ignoring case.
/// * `match_slash` - Whether the `*` can match `/`.
///
/// # Returns
///
/// The index of the next text byte that matches `wanted`, or `None` if the
/// text, or the folder name, ends first.
#[must_use]
pub(crate) fn skip_to_literal(
    input: WildmatchInput<'_>,
    text_index: usize,
    wanted: u8,
    match_slash: bool,
) -> Option<usize> {
    let mut index = text_index;
    loop {
        let byte = byte_at(input.text, index);
        if byte == 0 || (!match_slash && byte == b'/') {
            return None;
        }
        if fold_byte(byte, input.casefold) == wanted {
            return Some(index);
        }
        index += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::skip_to_literal;
    use crate::types::WildmatchInput;

    fn input(text: &[u8], casefold: bool) -> WildmatchInput<'_> {
        WildmatchInput {
            pattern: b"",
            text,
            pathname: true,
            casefold,
        }
    }

    #[test]
    fn finds_the_next_matching_byte() {
        // Arrange
        let text = b"xxbxb";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', false);

        // Assert
        assert_eq!(result, Some(2));
    }

    #[test]
    fn finds_a_matching_byte_at_the_start() {
        // Arrange
        let text = b"bx";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', false);

        // Assert
        assert_eq!(result, Some(0));
    }

    #[test]
    fn stops_at_a_slash_when_the_star_cannot_match_one() {
        // Arrange
        let text = b"x/b";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn searches_past_a_slash_when_the_star_can_match_one() {
        // Arrange
        let text = b"x/b";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', true);

        // Assert
        assert_eq!(result, Some(2));
    }

    #[test]
    fn finds_a_slash_when_it_is_the_wanted_byte_and_slashes_can_match() {
        // Arrange
        let text = b"x/b";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'/', true);

        // Assert
        assert_eq!(result, Some(1));
    }

    #[test]
    fn finds_nothing_when_the_text_ends_first() {
        // Arrange
        let text = b"xxx";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn stops_at_a_nul() {
        // Arrange
        let text = b"x\0b";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', true);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn ignores_ascii_case_when_asked() {
        // Arrange
        let text = b"xB";

        // Act
        let result = skip_to_literal(input(text, true), 0, b'b', false);

        // Assert
        assert_eq!(result, Some(1));
    }

    #[test]
    fn keeps_case_when_not_asked_to_ignore_it() {
        // Arrange
        let text = b"xB";

        // Act
        let result = skip_to_literal(input(text, false), 0, b'b', false);

        // Assert
        assert_eq!(result, None);
    }
}
