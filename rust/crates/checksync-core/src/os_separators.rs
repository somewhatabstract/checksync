use std::path::MAIN_SEPARATOR;

/// Replace `/` with the platform's path separator.
///
/// On Windows this turns `/` into `\`; elsewhere the separator is already
/// `/`, so the text is unchanged.
///
/// # Arguments
///
/// * `path` - The path to convert.
///
/// # Returns
///
/// The path with the platform's separators.
#[must_use]
pub fn os_separators(path: &str) -> String {
    path.replace('/', MAIN_SEPARATOR.encode_utf8(&mut [0; 4]))
}

#[cfg(test)]
mod tests {
    use std::path::MAIN_SEPARATOR;

    use super::os_separators;

    #[test]
    fn replaces_forward_slashes_with_the_platform_separator() {
        // Arrange
        let path = "a/b/c.js";

        // Act
        let result = os_separators(path);

        // Assert
        assert_eq!(result, format!("a{MAIN_SEPARATOR}b{MAIN_SEPARATOR}c.js"));
    }
}
