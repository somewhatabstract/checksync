use super::absolute_glob_text::absolute_glob_text;
use super::matches_pattern_set::matches_pattern_set;
use super::types::{ExcludeGlobs, ExcludePatterns};

/// Check whether an exclude pattern removes a file or prunes a folder.
///
/// Relative patterns are matched against the path's text, and absolute ones
/// against its absolute path. A pattern ending in `/**` also prunes the
/// folder before it, so `node_modules/**` prunes `node_modules`.
///
/// # Arguments
///
/// * `excludes` - The compiled exclude patterns.
/// * `text` - The path's text, relative to the working folder or absolute.
/// * `folder` - Whether the path is a folder.
///
/// # Returns
///
/// Whether the path is excluded.
#[must_use]
pub(super) fn is_excluded(excludes: &ExcludeGlobs, text: &[u8], folder: bool) -> bool {
    let matches = |patterns: &ExcludePatterns, text: &[u8]| {
        matches_pattern_set(&patterns.paths, text)
            || (folder && matches_pattern_set(&patterns.folders, text))
    };
    matches(&excludes.relative, text)
        || excludes
            .absolute
            .as_ref()
            .is_some_and(|absolute| matches(absolute, &absolute_glob_text(&excludes.cwd, text)))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::is_excluded;
    use crate::file_search::compile_exclude_globs::compile_exclude_globs;
    use crate::file_search::types::ExcludeGlobs;

    fn excludes(patterns: &[&str]) -> ExcludeGlobs {
        let patterns: Vec<String> = patterns.iter().map(|&pattern| pattern.to_owned()).collect();
        compile_exclude_globs(&patterns, Path::new("/repo/src"))
    }

    #[test]
    fn excludes_a_path_a_relative_pattern_matches() {
        // Arrange
        let excludes = excludes(&["**/gen/**"]);

        // Act
        let result = is_excluded(&excludes, b"x/gen/a.js", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_a_path_no_pattern_matches() {
        // Arrange
        let excludes = excludes(&["**/gen/**"]);

        // Act
        let result = is_excluded(&excludes, b"x/a.js", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn prunes_the_folder_before_a_trailing_double_star() {
        // Arrange
        let excludes = excludes(&["gen/**"]);

        // Act
        let result = is_excluded(&excludes, b"gen", true);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_a_file_named_like_the_folder_before_a_trailing_double_star() {
        // Arrange
        let excludes = excludes(&["gen/**"]);

        // Act
        let result = is_excluded(&excludes, b"gen", false);

        // Assert
        assert!(!result);
    }

    #[cfg(unix)]
    #[test]
    fn excludes_a_path_an_absolute_pattern_matches() {
        // Arrange
        let excludes = excludes(&["/repo/**/gen/**"]);

        // Act
        let result = is_excluded(&excludes, b"x/gen/a.js", false);

        // Assert
        assert!(result);
    }

    #[cfg(unix)]
    #[test]
    fn keeps_a_path_no_absolute_pattern_matches() {
        // Arrange
        let excludes = excludes(&["/repo/**/gen/**"]);

        // Act
        let result = is_excluded(&excludes, b"x/a.js", false);

        // Assert
        assert!(!result);
    }

    #[cfg(unix)]
    #[test]
    fn prunes_a_folder_before_an_absolute_trailing_double_star() {
        // Arrange
        let excludes = excludes(&["/repo/lib/**"]);

        // Act
        let result = is_excluded(&excludes, b"../lib", true);

        // Assert
        assert!(result);
    }
}
