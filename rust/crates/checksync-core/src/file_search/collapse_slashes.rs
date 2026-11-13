/// Turn runs of `/` inside a pattern into one, as paths have.
///
/// A leading `//`, which names a network share on Windows, is kept.
///
/// # Arguments
///
/// * `pattern` - The pattern.
///
/// # Returns
///
/// The pattern with single slashes between names.
#[must_use]
pub(super) fn collapse_slashes(pattern: &str) -> String {
    let (lead, rest) = if pattern.starts_with("//") {
        pattern.split_at(2)
    } else {
        ("", pattern)
    };
    let mut collapsed = lead.to_owned();
    for character in rest.chars() {
        if !(character == '/' && collapsed.ends_with('/')) {
            collapsed.push(character);
        }
    }
    collapsed
}

#[cfg(test)]
mod tests {
    use super::collapse_slashes;

    #[test]
    fn collapses_repeated_slashes() {
        // Arrange
        let pattern = "src//lib///*.js";

        // Act
        let result = collapse_slashes(pattern);

        // Assert
        assert_eq!(result, "src/lib/*.js");
    }

    #[test]
    fn keeps_single_slashes() {
        // Arrange
        let pattern = "src/lib/*.js";

        // Act
        let result = collapse_slashes(pattern);

        // Assert
        assert_eq!(result, "src/lib/*.js");
    }

    #[test]
    fn keeps_a_leading_double_slash() {
        // Arrange
        let pattern = "//server//share/*.js";

        // Act
        let result = collapse_slashes(pattern);

        // Assert
        assert_eq!(result, "//server/share/*.js");
    }

    #[test]
    fn collapses_slashes_after_the_root() {
        // Arrange
        let pattern = "/a//b";

        // Act
        let result = collapse_slashes(pattern);

        // Assert
        assert_eq!(result, "/a/b");
    }

    #[test]
    fn collapses_more_than_two_leading_slashes_to_two() {
        // Arrange
        let pattern = "///a/*.js";

        // Act
        let result = collapse_slashes(pattern);

        // Assert
        assert_eq!(result, "//a/*.js");
    }
}
