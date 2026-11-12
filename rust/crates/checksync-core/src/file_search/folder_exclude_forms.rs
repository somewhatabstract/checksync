/// List the forms of an exclude pattern that prune folders.
///
/// A pattern ending in `/**` excludes everything below the folder before it,
/// so it prunes that folder too: `node_modules/**` prunes `node_modules`.
///
/// # Arguments
///
/// * `pattern` - The exclude pattern, relative to the working folder.
///
/// # Returns
///
/// The pattern, and the folder before a trailing `/**` if it has one.
#[must_use]
pub(super) fn folder_exclude_forms(pattern: &str) -> Vec<&str> {
    std::iter::once(pattern)
        .chain(pattern.strip_suffix("/**"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::folder_exclude_forms;

    #[test]
    fn gives_a_pattern_without_a_trailing_double_star_as_it_is() {
        // Arrange
        let pattern = "build";

        // Act
        let result = folder_exclude_forms(pattern);

        // Assert
        assert_eq!(result, vec!["build"]);
    }

    #[test]
    fn adds_the_folder_before_a_trailing_double_star() {
        // Arrange
        let pattern = "node_modules/**";

        // Act
        let result = folder_exclude_forms(pattern);

        // Assert
        assert_eq!(result, vec!["node_modules/**", "node_modules"]);
    }
}
