/// Find how many names deep a pattern's files can be, if there's a limit.
///
/// Without `**`, each name in a pattern matches exactly one name in a path,
/// so a file can't be deeper than the pattern has names, and walking can stop
/// there. With `**`, files can be any depth.
///
/// # Arguments
///
/// * `pattern` - The pattern, with `/` between names.
///
/// # Returns
///
/// How many names a matching path has, or `None` if there's no limit.
#[must_use]
pub(super) fn pattern_name_limit(pattern: &str) -> Option<usize> {
    if pattern.contains("**") {
        None
    } else {
        Some(pattern.split('/').count())
    }
}

#[cfg(test)]
mod tests {
    use super::pattern_name_limit;

    #[test]
    fn limits_a_pattern_to_its_number_of_names() {
        // Arrange
        let pattern = "src/*/a.js";

        // Act
        let result = pattern_name_limit(pattern);

        // Assert
        assert_eq!(result, Some(3));
    }

    #[test]
    fn has_no_limit_with_a_double_star() {
        // Arrange
        let pattern = "src/**/a.js";

        // Act
        let result = pattern_name_limit(pattern);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn counts_a_single_name() {
        // Arrange
        let pattern = "*.js";

        // Act
        let result = pattern_name_limit(pattern);

        // Assert
        assert_eq!(result, Some(1));
    }
}
