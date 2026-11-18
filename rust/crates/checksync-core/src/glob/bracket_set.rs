//! Bracket sets such as `[!a-z]`: parsing them and matching units against them.

use super::bracket_item::BracketItem;

/// A parsed bracket expression, such as `[!a-z]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct BracketSet {
    /// Whether the set was negated with a leading `!` or `^`.
    pub(super) negated: bool,
    /// The members of the set, in the order they were written.
    pub(super) items: Vec<BracketItem>,
}

impl BracketSet {
    /// Parses the bracket expression, such as `[!a-z]`, whose `[` is at `index`.
    ///
    /// A leading `!` or `^` negates the set. A `]` straight after the `[`, or after
    /// the negation, is a member rather than the end of the set. With `unicode`, the
    /// members are characters rather than bytes. Returns the set and the index just
    /// past its closing `]`, or `None` if the set is malformed: never closed, or
    /// holding a malformed member.
    #[must_use]
    pub(super) fn parse(pattern: &[u8], index: usize, unicode: bool) -> Option<(Self, usize)> {
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
                return Some((Self { negated, items }, next + 1));
            }
            let (item, after) = BracketItem::read(pattern, next, unicode)?;
            items.push(item);
            next = after;
        }
    }

    /// Checks whether a unit of the text matches this bracket set.
    ///
    /// The unit is given by its `code`: a byte, or a code point in unicode mode. It
    /// matches a plain set when it matches a member, and a negated set when it
    /// matches none. When `casefold` is set, an ASCII letter is lowercased before
    /// it's compared with the members; [`BracketItem::matches`] describes what that
    /// means for each kind of member.
    #[must_use]
    pub(super) fn contains(&self, code: u32, casefold: bool) -> bool {
        let code = match u8::try_from(code) {
            Ok(byte) if casefold => u32::from(byte.to_ascii_lowercase()),
            _ => code,
        };
        let found = self.items.iter().any(|&item| item.matches(code, casefold));
        found != self.negated
    }
}

#[cfg(test)]
mod tests {
    use super::super::bracket_item::BracketItem;
    use super::BracketSet;

    #[test]
    fn parses_the_members_of_a_set() {
        // Arrange
        let pattern = b"[a-cx]y";

        // Act
        let result = BracketSet::parse(pattern, 0, false);

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
        let result = BracketSet::parse(pattern, 0, false);

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
        let result = BracketSet::parse(pattern, 0, false);

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
        let result = BracketSet::parse(pattern, 0, false);

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
        let result = BracketSet::parse(pattern, 0, false);

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
        let result = BracketSet::parse(pattern, 0, false);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_set_with_a_malformed_member() {
        // Arrange
        let pattern = b"[a[:foo:]]";

        // Act
        let result = BracketSet::parse(pattern, 0, false);

        // Assert
        assert_eq!(result, None);
    }

    fn set(negated: bool) -> BracketSet {
        BracketSet {
            negated,
            items: vec![
                BracketItem::Char(u32::from(b'a')),
                BracketItem::Char(u32::from(b'b')),
            ],
        }
    }

    #[test]
    fn matches_a_member() {
        // Arrange
        let set = set(false);

        // Act
        let result = set.contains(u32::from(b'b'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_non_member() {
        // Arrange
        let set = set(false);

        // Act
        let result = set.contains(u32::from(b'c'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_a_member_of_a_negated_set() {
        // Arrange
        let set = set(true);

        // Act
        let result = set.contains(u32::from(b'a'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_non_member_of_a_negated_set() {
        // Arrange
        let set = set(true);

        // Act
        let result = set.contains(u32::from(b'c'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn lowercases_the_byte_when_folding_case() {
        // Arrange
        let set = set(false);

        // Act
        let result = set.contains(u32::from(b'A'), true);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_the_case_of_the_byte_without_folding_case() {
        // Arrange
        let set = set(false);

        // Act
        let result = set.contains(u32::from(b'A'), false);

        // Assert
        assert!(!result);
    }
}
