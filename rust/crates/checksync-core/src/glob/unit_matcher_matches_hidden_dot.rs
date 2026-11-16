use super::types::UnitMatcher;

/// Check whether a single-unit token may match a hidden name's leading `.`.
///
/// This applies when hidden names are protected.
///
/// A literal or escaped unit and a bracket set that isn't negated may, so
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
pub(super) fn unit_matcher_matches_hidden_dot(matcher: &UnitMatcher) -> bool {
    match matcher {
        UnitMatcher::Literal(_) | UnitMatcher::Escaped(_) | UnitMatcher::Character(_) => true,
        UnitMatcher::Any => false,
        UnitMatcher::Set(set) => !set.negated,
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{BracketItem, BracketSet, UnitMatcher};
    use super::unit_matcher_matches_hidden_dot;

    fn set(negated: bool) -> UnitMatcher {
        UnitMatcher::Set(BracketSet {
            negated,
            items: vec![BracketItem::Char(u32::from(b'.'))],
        })
    }

    #[test]
    fn allows_a_literal() {
        // Arrange
        let matcher = UnitMatcher::Literal(b'.');

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn allows_an_escaped_byte() {
        // Arrange
        let matcher = UnitMatcher::Escaped(b'.');

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn refuses_a_question_mark() {
        // Arrange
        let matcher = UnitMatcher::Any;

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(!result);
    }

    #[test]
    fn allows_a_set() {
        // Arrange
        let matcher = set(false);

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(result);
    }

    #[test]
    fn refuses_a_negated_set() {
        // Arrange
        let matcher = set(true);

        // Act
        let result = unit_matcher_matches_hidden_dot(&matcher);

        // Assert
        assert!(!result);
    }
}
