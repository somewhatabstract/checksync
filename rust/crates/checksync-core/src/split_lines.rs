use crate::types::{Line, LineEnding};

/// Split text into lines the way the original JavaScript does.
///
/// `\r\n`, `\n` and a lone `\r` each end a line, and nothing else does, as in
/// Node.js 22 `readline` with `crlfDelay: Infinity`, which checksync used to
/// read files until 11.0.1. A line break at the end of the text doesn't start
/// an extra empty line, so empty text has no lines. Unlike `readline`, each
/// line keeps a record of its original ending.
///
/// Node.js 24 `readline` also ends lines at U+2028 and U+2029, so any
/// checksync version that used `readline` gave blocks containing them
/// different checksums when run on Node.js 24. Keeping them in the line
/// matches those versions on Node.js 22, checksync 11.0.1 and later, and the
/// original Python sync linter.
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
    let bytes = text.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        let ending = match bytes[index] {
            b'\n' => LineEnding::Lf,
            b'\r' if bytes.get(index + 1) == Some(&b'\n') => LineEnding::CrLf,
            b'\r' => LineEnding::Cr,
            _ => {
                index += 1;
                continue;
            }
        };
        lines.push(Line {
            text: text[start..index].to_owned(),
            ending,
        });
        index += ending.as_str().len();
        start = index;
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
        let text = "a\nb\r\nc\rd";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(
            result,
            vec![
                line("a", LineEnding::Lf),
                line("b", LineEnding::CrLf),
                line("c", LineEnding::Cr),
                line("d", LineEnding::None),
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
    fn splits_only_on_lf_crlf_and_cr() {
        // Arrange
        let text = "a\u{2028}b\u{b}c\u{c}d\u{85}e";

        // Act
        let result = split_lines(text);

        // Assert
        assert_eq!(result, vec![line(text, LineEnding::None)]);
    }
}
