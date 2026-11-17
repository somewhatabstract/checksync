//! Finding brace groups and the other pieces of a pattern being expanded.

use super::scan::brace_bracket_end;

/// A `{...}` group of comma-separated alternatives found in a pattern.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct BraceGroup {
    /// Where each alternative lies in the pattern, in order.
    pub(super) alternatives: Vec<std::ops::Range<usize>>,
    /// The index just past the group's closing `}`.
    pub(super) end: usize,
}

impl BraceGroup {
    /// Returns the brace group that the `{` at `open` starts, if it starts one.
    ///
    /// A `{` starts a group when a matching `}` follows, with nested braces balanced,
    /// and at least one comma lies between them outside any nested braces. A `\`
    /// escapes the byte after it, and braces and commas inside a `[...]` region don't
    /// count; an unclosed region means no group. Returns the group's alternatives and
    /// end, or `None` if the `{` is just a literal byte.
    #[must_use]
    fn find(pattern: &[u8], open: usize) -> Option<Self> {
        let mut depth = 0_usize;
        let mut alternatives = Vec::new();
        let mut start = open + 1;
        let mut index = start;
        while index < pattern.len() {
            match pattern[index] {
                b'\\' => index += 1,
                b'[' => {
                    index = brace_bracket_end(pattern, index)?;
                    continue;
                }
                b'{' => depth += 1,
                b'}' if depth > 0 => depth -= 1,
                b'}' => {
                    if alternatives.is_empty() {
                        return None;
                    }
                    alternatives.push(start..index);
                    return Some(BraceGroup {
                        alternatives,
                        end: index + 1,
                    });
                }
                b',' if depth == 0 => {
                    alternatives.push(start..index);
                    start = index + 1;
                }
                _ => {}
            }
            index += 1;
        }
        None
    }
}

/// What the next piece of a pattern being brace-expanded is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum BracePiece {
    /// Text kept as written, up to the given index.
    Text(usize),
    /// A brace group.
    Group(BraceGroup),
}

impl BracePiece {
    /// Returns what the next piece of a pattern being brace-expanded is.
    ///
    /// `pattern` ends where the run being expanded ends, and `index`, where the piece
    /// starts, must be within it. A piece is a brace group; a `\` and the byte after
    /// it; a `[...]` region, or the rest of the pattern if the region is never
    /// closed; a `{` that starts no group; or a run of other bytes. Everything but a
    /// group is kept exactly as written, so for those this returns where the text
    /// kept as written ends.
    #[must_use]
    pub(super) fn read(pattern: &[u8], index: usize) -> Self {
        let end = match pattern[index] {
            b'\\' => (index + 2).min(pattern.len()),
            b'[' => brace_bracket_end(pattern, index).unwrap_or(pattern.len()),
            b'{' => {
                return BraceGroup::find(pattern, index)
                    .map_or(BracePiece::Text(index + 1), BracePiece::Group);
            }
            _ => pattern[index..]
                .iter()
                .position(|byte| matches!(byte, b'\\' | b'[' | b'{'))
                .map_or(pattern.len(), |offset| index + offset),
        };
        BracePiece::Text(end)
    }
}

#[cfg(test)]
mod tests {
    use super::{BraceGroup, BracePiece};

    #[test]
    fn finds_a_run_of_ordinary_bytes() {
        // Arrange
        let pattern = b"ab,}{c,d}";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(4));
    }

    #[test]
    fn finds_ordinary_bytes_to_the_end() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(2));
    }

    #[test]
    fn finds_an_escape_and_the_byte_after_it() {
        // Arrange
        let pattern = b"\\{a";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(2));
    }

    #[test]
    fn finds_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = BracePiece::read(pattern, 1);

        // Assert
        assert_eq!(result, BracePiece::Text(2));
    }

    #[test]
    fn finds_a_bracket_region_whole() {
        // Arrange
        let pattern = b"[{a,b}]c";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(7));
    }

    #[test]
    fn finds_the_rest_after_an_unclosed_bracket() {
        // Arrange
        let pattern = b"[{a,b}";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(6));
    }

    #[test]
    fn finds_a_group() {
        // Arrange
        let pattern = b"{a,b}e";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(
            result,
            BracePiece::Group(BraceGroup {
                alternatives: vec![1..2, 3..4],
                end: 5,
            })
        );
    }

    #[test]
    fn finds_a_brace_that_starts_no_group_as_a_byte() {
        // Arrange
        let pattern = b"{a}";

        // Act
        let result = BracePiece::read(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(1));
    }

    #[test]
    fn finds_the_alternatives_of_a_group() {
        // Arrange
        let pattern = b"x{a,bc}y";

        // Act
        let result = BraceGroup::find(pattern, 1);

        // Assert
        assert_eq!(
            result,
            Some(BraceGroup {
                alternatives: vec![2..3, 4..6],
                end: 7,
            })
        );
    }

    #[test]
    fn keeps_a_nested_group_inside_one_alternative() {
        // Arrange
        let pattern = b"{a,b{c,d}}";

        // Act
        let result = BraceGroup::find(pattern, 0);

        // Assert
        assert_eq!(
            result,
            Some(BraceGroup {
                alternatives: vec![1..2, 3..9],
                end: 10,
            })
        );
    }

    #[test]
    fn finds_no_group_without_a_comma() {
        // Arrange
        let pattern = b"{a}";

        // Act
        let result = BraceGroup::find(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_no_group_without_a_closing_brace() {
        // Arrange
        let pattern = b"{a,b{c}";

        // Act
        let result = BraceGroup::find(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn ignores_escaped_braces_and_commas() {
        // Arrange
        let pattern = b"{a\\,b\\},c}";

        // Act
        let result = BraceGroup::find(pattern, 0);

        // Assert
        assert_eq!(
            result,
            Some(BraceGroup {
                alternatives: vec![1..7, 8..9],
                end: 10,
            })
        );
    }

    #[test]
    fn ignores_commas_inside_brackets() {
        // Arrange
        let pattern = b"{[a,b]}";

        // Act
        let result = BraceGroup::find(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_no_group_with_an_unclosed_bracket() {
        // Arrange
        let pattern = b"{a,[b}";

        // Act
        let result = BraceGroup::find(pattern, 0);

        // Assert
        assert_eq!(result, None);
    }
}
