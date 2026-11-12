use super::types::ByteMatcher;

/// Check whether a single-byte token may match a `.` that starts a name
/// when hidden names are protected.
///
/// A literal or escaped byte and a bracket set that isn't negated may, so
/// they match it if they match a `.` at all; `?` and negated sets may not.
///
/// # Arguments
///
/// * `matcher` - What the byte has to be.
///
/// # Returns
///
/// `true` if the token may match a `.` starting a name.
#[must_use]
pub(super) fn byte_matcher_matches_hidden_dot(matcher: &ByteMatcher) -> bool {
    match matcher {
        ByteMatcher::Literal(_) | ByteMatcher::Escaped(_) => true,
        ByteMatcher::Any => false,
        ByteMatcher::Set(set) => !set.negated,
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{BracketItem, BracketSet, ByteMatcher};
    use super::byte_matcher_matches_hidden_dot;

    fn set(negated: bool) -> ByteMatcher {
        ByteMatcher::Set(BracketSet {
            negated,
            items: vec![BracketItem::Byte(b'.')],
        })
    }

    #[test]
    fn allows_a_literal() {
        // Arrange
        let matcher = ByteMatcher::Literal(b'.');

        // Act
        let result = byte_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn allows_an_escaped_byte() {
        // Arrange
        let matcher = ByteMatcher::Escaped(b'.');

        // Act
        let result = byte_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn refuses_a_question_mark() {
        // Arrange
        let matcher = ByteMatcher::Any;

        // Act
        let result = byte_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(!result);
    }

    #[test]
    fn allows_a_set() {
        // Arrange
        let matcher = set(false);

        // Act
        let result = byte_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn refuses_a_negated_set() {
        // Arrange
        let matcher = set(true);

        // Act
        let result = byte_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(!result);
    }
}
