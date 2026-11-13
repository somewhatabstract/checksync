/// Check whether a name starts with a bracket set that may match a `.`.
///
/// A set that isn't negated may match a `.` when it lists one or has a range
/// that covers one. A character class or an escape is taken to match one
/// too, as this only decides whether hidden folders are worth walking, so it
/// errs towards yes.
///
/// # Arguments
///
/// * `name` - One name from a pattern.
///
/// # Returns
///
/// Whether the name starts with such a set.
#[must_use]
pub(super) fn bracket_may_match_dot(name: &str) -> bool {
    let Some(set) = name.strip_prefix('[') else {
        return false;
    };
    if set.starts_with(['!', '^']) {
        return false;
    }
    // A `]` straight after the `[` is part of the set, not its end.
    let body_end = set
        .char_indices()
        .skip(1)
        .find(|&(_, character)| character == ']')
        .map_or(set.len(), |(index, _)| index);
    let body: Vec<char> = set[..body_end].chars().collect();
    let mut index = 0;
    while index < body.len() {
        let character = body[index];
        if matches!(character, '.' | '[' | '\\') {
            return true;
        }
        if body.get(index + 1) == Some(&'-')
            && let Some(&end) = body.get(index + 2)
        {
            if (character..=end).contains(&'.') {
                return true;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::bracket_may_match_dot;

    #[test]
    fn finds_a_set_listing_a_dot() {
        // Arrange
        let name = "[._]config";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_set_with_a_range() {
        // Arrange
        let name = "[+-/]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_set_with_a_character_class() {
        // Arrange
        let name = "[[:punct:]]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_an_escaped_character_in_a_set() {
        // Arrange
        let name = "[\\.]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_range_that_does_not_cover_a_dot() {
        // Arrange
        let name = "[A-Z]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_set_without_a_dot() {
        // Arrange
        let name = "[abc]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_dot_after_the_set() {
        // Arrange
        let name = "[]a].x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_negated_set() {
        // Arrange
        let name = "[!.]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_name_without_a_set() {
        // Arrange
        let name = "x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }
}
