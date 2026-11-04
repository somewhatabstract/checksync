use std::path::MAIN_SEPARATOR;

/// Replace the platform's path separator with `/`.
///
/// On Windows this turns `\` into `/`; elsewhere the separator is already
/// `/`, so the text is unchanged. Checksums and output use `/` so they're
/// the same on every platform.
///
/// # Arguments
///
/// * `path` - The path to convert.
///
/// # Returns
///
/// The path with `/` separators.
#[must_use]
pub fn normalize_separators(path: &str) -> String {
    path.replace(MAIN_SEPARATOR, "/")
}

#[cfg(test)]
mod tests {
    use std::path::MAIN_SEPARATOR;

    use super::normalize_separators;

    #[test]
    fn replaces_the_platform_separator_with_a_forward_slash() {
        // Arrange
        let path = format!("a{MAIN_SEPARATOR}b{MAIN_SEPARATOR}c.js");

        // Act
        let result = normalize_separators(&path);

        // Assert
        assert_eq!(result, "a/b/c.js");
    }

    #[test]
    fn keeps_forward_slashes() {
        // Arrange
        let path = "a/b/c.js";

        // Act
        let result = normalize_separators(path);

        // Assert
        assert_eq!(result, "a/b/c.js");
    }
}
