/// Remove any leading `./` from a pattern.
///
/// A pattern relative to the working folder may start with `./`, or several,
/// which name the working folder itself and so change nothing.
///
/// # Arguments
///
/// * `pattern` - The pattern.
///
/// # Returns
///
/// The pattern without its leading `./`s.
#[must_use]
pub(super) fn strip_leading_dot_slash(pattern: &str) -> &str {
    let mut rest = pattern;
    while let Some(after) = rest.strip_prefix("./") {
        rest = after;
    }
    rest
}

#[cfg(test)]
mod tests {
    use super::strip_leading_dot_slash;

    #[test]
    fn removes_a_leading_dot_slash() {
        // Arrange
        let pattern = "./src/a.js";

        // Act
        let result = strip_leading_dot_slash(pattern);

        // Assert
        assert_eq!(result, "src/a.js");
    }

    #[test]
    fn removes_several_leading_dot_slashes() {
        // Arrange
        let pattern = "././src/a.js";

        // Act
        let result = strip_leading_dot_slash(pattern);

        // Assert
        assert_eq!(result, "src/a.js");
    }

    #[test]
    fn keeps_a_pattern_without_one() {
        // Arrange
        let pattern = "src/a.js";

        // Act
        let result = strip_leading_dot_slash(pattern);

        // Assert
        assert_eq!(result, "src/a.js");
    }

    #[test]
    fn keeps_a_leading_parent_folder() {
        // Arrange
        let pattern = "../a.js";

        // Act
        let result = strip_leading_dot_slash(pattern);

        // Assert
        assert_eq!(result, "../a.js");
    }

    #[test]
    fn keeps_a_dot_on_its_own() {
        // Arrange
        let pattern = ".";

        // Act
        let result = strip_leading_dot_slash(pattern);

        // Assert
        assert_eq!(result, ".");
    }
}
