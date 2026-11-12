use crate::bracket_item_matches::bracket_item_matches;
use crate::types::BracketSet;

/// Check whether a byte of the text matches a bracket set.
///
/// When folding case, the byte is lowercased before it's compared with the
/// members; `bracket_item_matches` describes what that means for each kind
/// of member.
///
/// # Arguments
///
/// * `set` - The bracket set.
/// * `byte` - The byte of the text.
/// * `casefold` - Whether ASCII letters match regardless of case.
///
/// # Returns
///
/// `true` if the byte matches a member of a plain set, or no member of a
/// negated one.
#[must_use]
pub(crate) fn bracket_set_contains(set: &BracketSet, byte: u8, casefold: bool) -> bool {
    let byte = if casefold {
        byte.to_ascii_lowercase()
    } else {
        byte
    };
    let found = set
        .items
        .iter()
        .any(|&item| bracket_item_matches(item, byte, casefold));
    found != set.negated
}

#[cfg(test)]
mod tests {
    use super::bracket_set_contains;
    use crate::types::{BracketItem, BracketSet};

    fn set(negated: bool) -> BracketSet {
        BracketSet {
            negated,
            items: vec![BracketItem::Byte(b'a'), BracketItem::Byte(b'b')],
        }
    }

    #[test]
    fn matches_a_member() {
        // Arrange
        let set = set(false);

        // Act
        let result = bracket_set_contains(&set, b'b', false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_non_member() {
        // Arrange
        let set = set(false);

        // Act
        let result = bracket_set_contains(&set, b'c', false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_a_member_of_a_negated_set() {
        // Arrange
        let set = set(true);

        // Act
        let result = bracket_set_contains(&set, b'a', false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_non_member_of_a_negated_set() {
        // Arrange
        let set = set(true);

        // Act
        let result = bracket_set_contains(&set, b'c', false);

        // Assert
        assert!(result);
    }

    #[test]
    fn lowercases_the_byte_when_folding_case() {
        // Arrange
        let set = set(false);

        // Act
        let result = bracket_set_contains(&set, b'A', true);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_the_case_of_the_byte_without_folding_case() {
        // Arrange
        let set = set(false);

        // Act
        let result = bracket_set_contains(&set, b'A', false);

        // Assert
        assert!(!result);
    }
}
