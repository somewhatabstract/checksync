use super::read_bracket_item::read_bracket_item;
use super::types::BracketSet;

/// Parse a bracket expression, such as `[!a-z]`, from a glob pattern.
///
/// A leading `!` or `^` negates the set. A `]` straight after the `[`, or
/// after the negation, is a member rather than the end of the set.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the opening `[` is in the pattern.
/// * `unicode` - Whether members are characters rather than bytes.
///
/// # Returns
///
/// The set and the index just past its closing `]`, or `None` if the set is
/// malformed: never closed, or holding a malformed member.
#[must_use]
pub(super) fn parse_bracket_set(
    pattern: &[u8],
    index: usize,
    unicode: bool,
) -> Option<(BracketSet, usize)> {
    let mut next = index + 1;
    let negated = matches!(pattern.get(next), Some(b'!' | b'^'));
    if negated {
        next += 1;
    }
    let first = next;
    let mut items = Vec::new();
    loop {
        let byte = *pattern.get(next)?;
        if byte == b']' && next != first {
            return Some((BracketSet { negated, items }, next + 1));
        }
        let (item, after) = read_bracket_item(pattern, next, unicode)?;
        items.push(item);
        next = after;
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{BracketItem, BracketSet};
    use super::parse_bracket_set;

    #[test]
    fn parses_the_members_of_a_set() {
        // Arrange
        let pattern = b"[a-cx]y";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(
            result,
            Some((
                BracketSet {
                    negated: false,
                    items: vec![
                        BracketItem::Range(u32::from(b'a'), u32::from(b'c')),
                        BracketItem::Char(u32::from(b'x'))
                    ],
                },
                6
            ))
        );
    }

    #[test]
    fn negates_a_set_starting_with_an_exclamation_mark() {
        // Arrange
        let pattern = b"[!a]";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(
            result,
            Some((
                BracketSet {
                    negated: true,
                    items: vec![BracketItem::Char(u32::from(b'a'))],
                },
                4
            ))
        );
    }

    #[test]
    fn negates_a_set_starting_with_a_caret() {
        // Arrange
        let pattern = b"[^a]";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(
            result,
            Some((
                BracketSet {
                    negated: true,
                    items: vec![BracketItem::Char(u32::from(b'a'))],
                },
                4
            ))
        );
    }

    #[test]
    fn treats_a_leading_closing_bracket_as_a_member() {
        // Arrange
        let pattern = b"[]]";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(
            result,
            Some((
                BracketSet {
                    negated: false,
                    items: vec![BracketItem::Char(u32::from(b']'))],
                },
                3
            ))
        );
    }

    #[test]
    fn treats_a_closing_bracket_after_the_negation_as_a_member() {
        // Arrange
        let pattern = b"[!]]";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(
            result,
            Some((
                BracketSet {
                    negated: true,
                    items: vec![BracketItem::Char(u32::from(b']'))],
                },
                4
            ))
        );
    }

    #[test]
    fn rejects_a_set_that_is_never_closed() {
        // Arrange
        let pattern = b"[ab";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_set_with_a_malformed_member() {
        // Arrange
        let pattern = b"[a[:foo:]]";

        // Act
        let result = parse_bracket_set(pattern, 0, false);

        // Assert
        assert_eq!(result, None);
    }
}
