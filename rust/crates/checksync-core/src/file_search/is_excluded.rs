use crate::glob::{CompiledGlob, compiled_glob_matches};

/// Check whether any exclude pattern removes a file or prunes a folder.
///
/// # Arguments
///
/// * `excludes` - The compiled exclude patterns.
/// * `text` - The file's or folder's text, relative to the working folder.
///
/// # Returns
///
/// Whether it's excluded.
#[must_use]
pub(super) fn is_excluded(excludes: &[CompiledGlob], text: &[u8]) -> bool {
    excludes
        .iter()
        .any(|exclude| compiled_glob_matches(exclude, text))
}

#[cfg(test)]
mod tests {
    use super::is_excluded;
    use crate::file_search::compile_folder_exclude::compile_folder_exclude;
    use crate::glob::CompiledGlob;

    fn excludes(patterns: &[&str]) -> Vec<CompiledGlob> {
        patterns
            .iter()
            .flat_map(|pattern| compile_folder_exclude(pattern))
            .collect()
    }

    #[test]
    fn excludes_a_matching_file() {
        // Arrange
        let excludes = excludes(&["**/*.log"]);

        // Act
        let result = is_excluded(&excludes, b"src/a.log");

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_a_file_no_pattern_matches() {
        // Arrange
        let excludes = excludes(&["**/*.log"]);

        // Act
        let result = is_excluded(&excludes, b"src/a.js");

        // Assert
        assert!(!result);
    }

    #[test]
    fn excludes_a_hidden_file_with_a_wildcard() {
        // Arrange
        let excludes = excludes(&["**/*.js"]);

        // Act
        let result = is_excluded(&excludes, b".hidden/a.js");

        // Assert
        assert!(result);
    }

    #[test]
    fn prunes_a_folder_whose_contents_a_pattern_excludes() {
        // Arrange
        let excludes = excludes(&["node_modules/**"]);

        // Act
        let result = is_excluded(&excludes, b"node_modules");

        // Assert
        assert!(result);
    }

    #[test]
    fn excludes_nothing_without_patterns() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = is_excluded(&excludes, b"src");

        // Assert
        assert!(!result);
    }
}
