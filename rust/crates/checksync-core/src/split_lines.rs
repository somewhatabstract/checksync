use crate::types::{Line, LineEnding};

/// Split text into lines the way the original JavaScript does.
///
/// Matches Node.js 24 `readline` with `crlfDelay: Infinity`: `\r\n`, `\n`, a
/// lone `\r`, U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR each end a
/// line, and nothing else does. (Node.js 22 doesn't treat U+2028 and U+2029 as
/// line breaks; checksync requires Node.js 24.) A line break at the end of the
/// text doesn't start an extra empty line, so empty text has no lines. Unlike
/// `readline`, each line keeps a record of its original ending.
///
/// # Arguments
///
/// * `text` - The decoded file contents.
///
/// # Returns
///
/// The lines, in order.
#[must_use]
pub fn split_lines(text: &str) -> Vec<Line> {
    let mut lines = Vec::new();
    let mut start = 0;
    let mut chars = text.char_indices().peekable();
    while let Some((index, c)) = chars.next() {
        let ending = match c {
            '\n' => LineEnding::Lf,
            '\r' if chars.next_if(|&(_, next)| next == '\n').is_some() => LineEnding::CrLf,
            '\r' => LineEnding::Cr,
            '\u{2028}' => LineEnding::LineSeparator,
            '\u{2029}' => LineEnding::ParagraphSeparator,
            _ => continue,
        };
        lines.push(Line {
            text: text[start..index].to_owned(),
            ending,
        });
        start = index + ending.as_str().len();
    }
    if start < text.len() {
        lines.push(Line {
            text: text[start..].to_owned(),
            ending: LineEnding::None,
        });
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::split_lines;
    use crate::types::{Line, LineEnding};

    fn line(text: &str, ending: LineEnding) -> Line {
        Line {
            text: text.to_owned(),
            ending,
        }
    }

    #[test]
    fn gives_no_lines_for_empty_text() {
        // Arrange
        let text = "";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(result, Vec::<Line>::new());
    }

    #[test]
    fn records_each_kind_of_line_ending() {
        // Arrange
        let text = "a\nb\r\nc\rd\u{2028}e\u{2029}f";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(
            result,
            vec![
                line("a", LineEnding::Lf),
                line("b", LineEnding::CrLf),
                line("c", LineEnding::Cr),
                line("d", LineEnding::LineSeparator),
                line("e", LineEnding::ParagraphSeparator),
                line("f", LineEnding::None),
            ]
        );
    }

    #[test]
    fn treats_a_cr_before_a_crlf_as_its_own_line_ending() {
        // Arrange
        let text = "a\r\r\n";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(
            result,
            vec![line("a", LineEnding::Cr), line("", LineEnding::CrLf)]
        );
    }

    #[test]
    fn adds_no_empty_line_after_a_final_line_ending() {
        // Arrange
        let text = "a\n";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(result, vec![line("a", LineEnding::Lf)]);
    }

    #[test]
    fn does_not_split_on_other_control_or_separator_characters() {
        // Arrange
        let text = "a\u{b}b\u{c}c\u{85}d";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(result, vec![line(text, LineEnding::None)]);
    }
}
