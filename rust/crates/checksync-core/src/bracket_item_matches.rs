use crate::posix_class_contains::posix_class_contains;
use crate::types::BracketItem;

/// Check whether a byte of the text matches one member of a bracket set.
///
/// A range always matches its first byte, even when it's written backwards
/// (so `[z-a]` matches only `z`), and otherwise matches the bytes from its
/// first to its last. When folding case, the caller passes the byte already
/// lowercased; a single byte then matches only as written, while a range or
/// class also matches if the byte's uppercase form is inside it, so `[A-Z]`
/// and `[:upper:]` match `a` but `[A]` doesn't.
///
/// # Arguments
///
/// * `item` - The member of the set.
/// * `byte` - The byte of the text, lowercased if `casefold` is set.
/// * `casefold` - Whether ASCII letters match regardless of case.
///
/// # Returns
///
/// `true` if the byte matches the member.
#[must_use]
pub(crate) fn bracket_item_matches(item: BracketItem, byte: u8, casefold: bool) -> bool {
    let upper = byte.to_ascii_uppercase();
    match item {
        BracketItem::Byte(member) => byte == member,
        BracketItem::Range(first, last) => {
            let range = first..=last;
            byte == first || range.contains(&byte) || (casefold && range.contains(&upper))
        }
        BracketItem::Class(class) => {
            posix_class_contains(class, byte) || (casefold && posix_class_contains(class, upper))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::bracket_item_matches;
    use crate::types::{BracketItem, PosixClass};

    #[test]
    fn matches_the_same_byte() {
        // Arrange
        let item = BracketItem::Byte(b'a');

        // Act
        let result = bracket_item_matches(item, b'a', false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_different_byte() {
        // Arrange
        let item = BracketItem::Byte(b'a');

        // Act
        let result = bracket_item_matches(item, b'b', false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_fold_an_uppercase_byte_member() {
        // Arrange
        let item = BracketItem::Byte(b'A');

        // Act
        let result = bracket_item_matches(item, b'a', true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_byte_inside_a_range() {
        // Arrange
        let item = BracketItem::Range(b'a', b'z');

        // Act
        let result = bracket_item_matches(item, b'm', false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_byte_outside_a_range() {
        // Arrange
        let item = BracketItem::Range(b'a', b'y');

        // Act
        let result = bracket_item_matches(item, b'z', false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_the_first_byte_of_a_backwards_range() {
        // Arrange
        let item = BracketItem::Range(b'z', b'a');

        // Act
        let result = bracket_item_matches(item, b'z', false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_the_last_byte_of_a_backwards_range() {
        // Arrange
        let item = BracketItem::Range(b'z', b'a');

        // Act
        let result = bracket_item_matches(item, b'a', false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_range_by_uppercase_when_folding_case() {
        // Arrange
        let item = BracketItem::Range(b'A', b'Z');

        // Act
        let result = bracket_item_matches(item, b'b', true);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_range_by_uppercase_without_folding_case() {
        // Arrange
        let item = BracketItem::Range(b'A', b'Z');

        // Act
        let result = bracket_item_matches(item, b'b', false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_the_first_byte_of_a_backwards_range_by_uppercase() {
        // Arrange
        let item = BracketItem::Range(b'Z', b'A');

        // Act
        let result = bracket_item_matches(item, b'z', true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_byte_in_a_class() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Digit);

        // Act
        let result = bracket_item_matches(item, b'5', false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_class_by_uppercase_when_folding_case() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Upper);

        // Act
        let result = bracket_item_matches(item, b'a', true);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_class_by_uppercase_without_folding_case() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Upper);

        // Act
        let result = bracket_item_matches(item, b'a', false);

        // Assert
        assert!(!result);
    }
}
