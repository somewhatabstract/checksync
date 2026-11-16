use crate::glob::compiled_glob_matches;

use super::types::PatternSet;

/// Check whether a path matches any pattern in a set, as a glob or by its text.
///
/// # Arguments
///
/// * `set` - The patterns.
/// * `text` - The path's text, relative to the working folder.
///
/// # Returns
///
/// Whether any pattern matches.
#[must_use]
pub(super) fn matches_pattern_set(set: &PatternSet, text: &[u8]) -> bool {
    set.literals.iter().any(|literal| literal == text)
        || set
            .globs
            .iter()
            .any(|glob| compiled_glob_matches(glob, text))
}

#[cfg(test)]
mod tests {
    use super::matches_pattern_set;
    use crate::file_search::EXCLUDE_GLOB_OPTIONS;
    use crate::file_search::compile_pattern_set::compile_pattern_set;

    #[test]
    fn matches_a_path_a_glob_matches() {
        // Arrange
        let set = compile_pattern_set(["**/*.log"], EXCLUDE_GLOB_OPTIONS);

        // Act
        let result = matches_pattern_set(&set, b"src/a.log");

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_path_whose_text_is_a_pattern() {
        // Arrange
        let set = compile_pattern_set(["app/[slug]/page.tsx"], EXCLUDE_GLOB_OPTIONS);

        // Act
        let result = matches_pattern_set(&set, b"app/[slug]/page.tsx");

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_the_text_of_a_pattern_that_is_not_a_valid_glob() {
        // Arrange
        let set = compile_pattern_set(["[unclosed"], EXCLUDE_GLOB_OPTIONS);

        // Act
        let result = matches_pattern_set(&set, b"[unclosed");

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_path_no_pattern_matches() {
        // Arrange
        let set = compile_pattern_set(["**/*.log"], EXCLUDE_GLOB_OPTIONS);

        // Act
        let result = matches_pattern_set(&set, b"src/a.js");

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_nothing_without_patterns() {
        // Arrange
        let set = compile_pattern_set([], EXCLUDE_GLOB_OPTIONS);

        // Act
        let result = matches_pattern_set(&set, b"src");

        // Assert
        assert!(!result);
    }
}
