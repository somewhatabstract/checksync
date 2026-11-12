use super::brace_bracket_end::brace_bracket_end;
use super::find_brace_group::find_brace_group;
use super::types::BracePiece;

/// Find what the next piece of a pattern being brace-expanded is.
///
/// A piece is a brace group; a `\` and the byte after it; a `[...]` region,
/// or the rest of the pattern if the region is never closed; a `{` that
/// starts no group; or a run of other bytes. Everything but a group is
/// kept exactly as written.
///
/// # Arguments
///
/// * `pattern` - The pattern, ending where the run being expanded ends.
/// * `index` - Where the piece starts. Must be within the pattern.
///
/// # Returns
///
/// The group, or where the text kept as written ends.
#[must_use]
pub(super) fn next_brace_piece(pattern: &[u8], index: usize) -> BracePiece {
    let end = match pattern[index] {
        b'\\' => (index + 2).min(pattern.len()),
        b'[' => brace_bracket_end(pattern, index).unwrap_or(pattern.len()),
        b'{' => {
            return find_brace_group(pattern, index)
                .map_or(BracePiece::Text(index + 1), BracePiece::Group);
        }
        _ => pattern[index..]
            .iter()
            .position(|byte| matches!(byte, b'\\' | b'[' | b'{'))
            .map_or(pattern.len(), |offset| index + offset),
    };
    BracePiece::Text(end)
}

#[cfg(test)]
mod tests {
    use super::super::types::{BraceGroup, BracePiece};
    use super::next_brace_piece;

    #[test]
    fn finds_a_run_of_ordinary_bytes() {
        // Arrange
        let pattern = b"ab,}{c,d}";

        // Act
        let result = next_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(4));
    }

    #[test]
    fn finds_ordinary_bytes_to_the_end() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = next_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(2));
    }

    #[test]
    fn finds_an_escape_and_the_byte_after_it() {
        // Arrange
        let pattern = b"\\{a";

        // Act
        let result = next_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(2));
    }

    #[test]
    fn finds_a_backslash_at_the_end() {
        // Arrange
        let pattern = b"a\\";

        // Act
        let result = next_brace_piece(pattern, 1);

        // Assert
        assert_eq!(result, BracePiece::Text(2));
    }

    #[test]
    fn finds_a_bracket_region_whole() {
        // Arrange
        let pattern = b"[{a,b}]c";

        // Act
        let result = next_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(7));
    }

    #[test]
    fn finds_the_rest_after_an_unclosed_bracket() {
        // Arrange
        let pattern = b"[{a,b}";

        // Act
        let result = next_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(6));
    }

    #[test]
    fn finds_a_group() {
        // Arrange
        let pattern = b"{a,b}e";

        // Act
        let result = next_brace_piece(pattern, 0);

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
        let result = next_brace_piece(pattern, 0);

        // Assert
        assert_eq!(result, BracePiece::Text(1));
    }
}
