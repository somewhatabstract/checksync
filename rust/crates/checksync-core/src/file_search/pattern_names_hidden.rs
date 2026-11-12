/// Check whether a pattern names something hidden, so hidden folders matter.
///
/// Wildcards never match a `.` that starts a name, so only a name in the
/// pattern that starts with a literal `.`, or with a bracket set that isn't
/// negated and so may hold one, can match inside a hidden folder. The names
/// `.` and `..` don't count, since they never name a hidden one.
///
/// # Arguments
///
/// * `pattern` - The pattern, with `/` between names.
///
/// # Returns
///
/// Whether walking needs to look inside hidden folders.
#[must_use]
pub(super) fn pattern_names_hidden(pattern: &str) -> bool {
    pattern.split('/').any(|name| {
        (name.starts_with('.') && name != "." && name != "..")
            || (name.starts_with('[') && !name.starts_with("[!") && !name.starts_with("[^"))
    })
}

#[cfg(test)]
mod tests {
    use super::pattern_names_hidden;

    #[test]
    fn finds_a_hidden_folder_name() {
        // Arrange
        let pattern = ".dotdir/**";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_hidden_name_after_a_folder() {
        // Arrange
        let pattern = "**/.gitignore";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_nothing_hidden_in_a_wildcard_pattern() {
        // Arrange
        let pattern = "src/**/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_count_parent_or_current_folders() {
        // Arrange
        let pattern = "../src/./*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_a_bracket_set_that_may_match_a_dot() {
        // Arrange
        let pattern = "[.]dotdir/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_count_a_negated_bracket_set() {
        // Arrange
        let pattern = "[!a]dotdir/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }
}
