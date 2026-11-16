use super::posix_class_contains::posix_class_contains;
use super::types::BracketItem;

/// Check whether a unit of the text matches one member of a bracket set.
///
/// Units are compared by code: a byte, or a code point in unicode mode. A
/// range always matches its first code, even when it's written backwards
/// (so `[z-a]` matches only `z`), and otherwise matches the codes from its
/// first to its last. When folding case, the caller passes an ASCII letter
/// already lowercased; a single member then matches only as written, while
/// a range or class also matches if the letter's uppercase form is inside
/// it, so `[A-Z]` and `[:upper:]` match `a` but `[A]` doesn't. Classes only
/// ever hold ASCII.
///
/// # Arguments
///
/// * `item` - The member of the set.
/// * `code` - The unit's code, with an ASCII letter lowercased if
///   `casefold` is set.
/// * `casefold` - Whether ASCII letters match regardless of case.
///
/// # Returns
///
/// `true` if the unit matches the member.
#[must_use]
pub(super) fn bracket_item_matches(item: BracketItem, code: u32, casefold: bool) -> bool {
    let upper = u8::try_from(code).map_or(code, |byte| u32::from(byte.to_ascii_uppercase()));
    let in_class =
        |class, code| u8::try_from(code).is_ok_and(|byte| posix_class_contains(class, byte));
    match item {
        BracketItem::Char(member) => code == member,
        BracketItem::Range(first, last) => {
            let range = first..=last;
            code == first || range.contains(&code) || (casefold && range.contains(&upper))
        }
        BracketItem::Class(class) => in_class(class, code) || (casefold && in_class(class, upper)),
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{BracketItem, PosixClass};
    use super::bracket_item_matches;

    #[test]
    fn matches_the_same_byte() {
        // Arrange
        let item = BracketItem::Char(u32::from(b'a'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'a'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_different_byte() {
        // Arrange
        let item = BracketItem::Char(u32::from(b'a'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'b'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_fold_an_uppercase_byte_member() {
        // Arrange
        let item = BracketItem::Char(u32::from(b'A'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'a'), true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_byte_inside_a_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'a'), u32::from(b'z'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'm'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_byte_outside_a_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'a'), u32::from(b'y'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'z'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_the_first_byte_of_a_backwards_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'z'), u32::from(b'a'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'z'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_the_last_byte_of_a_backwards_range() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'z'), u32::from(b'a'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'a'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_range_by_uppercase_when_folding_case() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'A'), u32::from(b'Z'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'b'), true);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_range_by_uppercase_without_folding_case() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'A'), u32::from(b'Z'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'b'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_match_the_first_byte_of_a_backwards_range_by_uppercase() {
        // Arrange
        let item = BracketItem::Range(u32::from(b'Z'), u32::from(b'A'));

        // Act
        let result = bracket_item_matches(item, u32::from(b'z'), true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_byte_in_a_class() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Digit);

        // Act
        let result = bracket_item_matches(item, u32::from(b'5'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_class_by_uppercase_when_folding_case() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Upper);

        // Act
        let result = bracket_item_matches(item, u32::from(b'a'), true);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_class_by_uppercase_without_folding_case() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Upper);

        // Act
        let result = bracket_item_matches(item, u32::from(b'a'), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_code_point_inside_a_range() {
        // Arrange
        let item = BracketItem::Range(u32::from('à'), u32::from('ÿ'));

        // Act
        let result = bracket_item_matches(item, u32::from('é'), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_code_point_outside_ascii_with_a_class() {
        // Arrange
        let item = BracketItem::Class(PosixClass::Alpha);

        // Act
        let result = bracket_item_matches(item, u32::from('é'), true);

        // Assert
        assert!(!result);
    }
}
