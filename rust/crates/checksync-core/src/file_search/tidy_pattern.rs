//! Tidying patterns into the form paths have.

/// Collapses a pattern's repeated slashes and drops its leading `./`s.
#[must_use]
pub(super) fn tidy_pattern(pattern: &str) -> String {
    strip_leading_dot_slash(&collapse_slashes(pattern)).to_owned()
}

/// Turns runs of `/` inside a pattern into one, as paths have.
///
/// A leading `//`, which names a network share on Windows, is kept.
#[must_use]
fn collapse_slashes(pattern: &str) -> String {
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

/// Removes any leading `./` from a pattern.
///
/// A pattern relative to the working folder may start with `./`, or several,
/// which name the working folder itself and so change nothing.
#[must_use]
fn strip_leading_dot_slash(pattern: &str) -> &str {
    let mut rest = pattern;
    while let Some(after) = rest.strip_prefix("./") {
        rest = after;
    }
    rest
}

#[cfg(test)]
mod tests {
    use super::{collapse_slashes, strip_leading_dot_slash, tidy_pattern};

    #[test]
    fn collapses_slashes_before_dropping_a_leading_dot_slash() {
        // Arrange
        let pattern = ".//.//src//*.js";

        // Act
        let result = tidy_pattern(pattern);

        // Assert
        assert_eq!(result, "src/*.js");
    }

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
