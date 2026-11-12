use crate::glob::{CompiledGlob, compile_glob};

use super::EXCLUDE_GLOB_OPTIONS;

/// Compile an exclude pattern for checking folders, which it prunes with all
/// they hold.
///
/// A pattern ending in `/**` excludes everything below the folder before it,
/// so it prunes that folder too: `node_modules/**` prunes `node_modules`.
/// Such a pattern compiles to both forms; any other compiles to one, and one
/// that can never match compiles to none.
///
/// # Arguments
///
/// * `pattern` - The exclude pattern, relative to the working folder.
///
/// # Returns
///
/// The compiled forms; a folder is pruned if it matches any of them.
#[must_use]
pub(super) fn compile_folder_exclude(pattern: &str) -> Vec<CompiledGlob> {
    std::iter::once(pattern)
        .chain(pattern.strip_suffix("/**"))
        .filter_map(|form| compile_glob(form.as_bytes(), EXCLUDE_GLOB_OPTIONS))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::compile_folder_exclude;
    use crate::glob::compiled_glob_matches;

    fn prunes(pattern: &str, folder: &str) -> bool {
        compile_folder_exclude(pattern)
            .iter()
            .any(|glob| compiled_glob_matches(glob, folder.as_bytes()))
    }

    #[test]
    fn compiles_a_pattern_to_one_form() {
        // Arrange
        let pattern = "build";

        // Act
        let result = compile_folder_exclude(pattern);

        // Assert
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn prunes_a_folder_the_pattern_names() {
        // Arrange
        let pattern = "build";

        // Act
        let result = prunes(pattern, "build");

        // Assert
        assert!(result);
    }

    #[test]
    fn prunes_the_folder_before_a_trailing_double_star() {
        // Arrange
        let pattern = "node_modules/**";

        // Act
        let result = prunes(pattern, "node_modules");

        // Assert
        assert!(result);
    }

    #[test]
    fn prunes_hidden_folders_with_wildcards() {
        // Arrange
        let pattern = "**/.*";

        // Act
        let result = prunes(pattern, "src/.cache");

        // Assert
        assert!(result);
    }

    #[test]
    fn compiles_a_pattern_that_can_never_match_to_nothing() {
        // Arrange
        let pattern = "[unclosed";

        // Act
        let result = compile_folder_exclude(pattern);

        // Assert
        assert!(result.is_empty());
    }
}
