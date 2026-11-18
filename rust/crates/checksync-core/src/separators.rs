//! Converting between `/` and the platform's path separator.

use std::path::MAIN_SEPARATOR;

/// Replaces the platform's path separator with `/`.
///
/// On Windows this turns `\` into `/`; elsewhere the separator is already
/// `/`, so the text is unchanged. Checksums and output use `/` so they're
/// the same on every platform.
#[must_use]
pub fn normalize_separators(path: &str) -> String {
    path.replace(MAIN_SEPARATOR, "/")
}

/// Replaces `/` with the platform's path separator.
///
/// On Windows this turns `/` into `\`; elsewhere the separator is already
/// `/`, so the text is unchanged.
#[must_use]
pub fn os_separators(path: &str) -> String {
    path.replace('/', MAIN_SEPARATOR.encode_utf8(&mut [0; 4]))
}

#[cfg(test)]
mod tests {
    use std::path::MAIN_SEPARATOR;

    use super::{normalize_separators, os_separators};

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
