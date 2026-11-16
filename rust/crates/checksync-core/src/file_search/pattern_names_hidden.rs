use super::bracket_may_match_dot::bracket_may_match_dot;

/// Check whether a pattern names a hidden folder, so hidden folders matter.
///
/// Wildcards never match a `.` that starts a name, so only a folder name in
/// the pattern that starts with a literal or escaped `.`, or with a bracket
/// set that may match one, can match a hidden folder. The last name is a file's, so it
/// doesn't count, and nor do the names `.` and `..`, which never name a
/// hidden folder.
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
    let folders = pattern.rsplit_once('/').map_or("", |(folders, _)| folders);
    folders.split('/').any(|name| {
        (name.starts_with('.') && name != "." && name != "..")
            || name.starts_with("\\.")
            || bracket_may_match_dot(name)
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
    fn ignores_a_hidden_file_name() {
        // Arrange
        let pattern = "**/.gitignore";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
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

    #[test]
    fn ignores_a_bracket_set_in_a_file_name() {
        // Arrange
        let pattern = "**/[.]x.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_bracket_set_that_cannot_match_a_dot() {
        // Arrange
        let pattern = "[A-Z]*/x.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_an_escaped_dot_at_the_start_of_a_folder_name() {
        // Arrange
        let pattern = "\\.c*/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }
}
