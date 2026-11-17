//! Sets of patterns that match a path as a glob or by its text.

use crate::glob::{CompiledGlob, GlobOptions, compile_glob, compiled_glob_matches};

/// Patterns that a path matches either as globs or as its literal text.
///
/// As in fast-glob, a pattern also matches a path whose text is exactly the
/// pattern, so `app/[slug]/page.tsx` finds that file even though `[slug]` is
/// a bracket set.
#[derive(Debug, Clone, Default)]
pub(super) struct PatternSet {
    /// The patterns compiled as globs.
    ///
    /// Those that can never match are left out.
    pub globs: Vec<CompiledGlob>,
    /// The patterns as literal text.
    pub literals: Vec<Vec<u8>>,
}

/// Compiles patterns into a set that matches a path as a glob or by its text.
///
/// The patterns are relative to the working folder, and `options` say how to
/// match them as globs.
#[must_use]
pub(super) fn compile_pattern_set<'a>(
    patterns: impl IntoIterator<Item = &'a str>,
    options: GlobOptions,
) -> PatternSet {
    let mut set = PatternSet::default();
    for pattern in patterns {
        set.globs.extend(compile_glob(pattern.as_bytes(), options));
        set.literals.push(pattern.as_bytes().to_vec());
    }
    set
}

/// Checks whether a path matches any pattern in a set, as a glob or by its text.
///
/// The path's text is relative to the working folder.
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
    use super::{compile_pattern_set, matches_pattern_set};
    use crate::file_search::{EXCLUDE_GLOB_OPTIONS, INCLUDE_GLOB_OPTIONS};

    #[test]
    fn compiles_each_pattern_as_a_glob() {
        // Arrange
        let patterns = ["*.js", "*.ts"];

        // Act
        let result = compile_pattern_set(patterns, INCLUDE_GLOB_OPTIONS);

        // Assert
        assert_eq!(result.globs.len(), 2);
    }

    #[test]
    fn keeps_each_pattern_as_literal_text() {
        // Arrange
        let patterns = ["*.js", "[unclosed"];

        // Act
        let result = compile_pattern_set(patterns, INCLUDE_GLOB_OPTIONS);

        // Assert
        assert_eq!(
            result.literals,
            vec![b"*.js".to_vec(), b"[unclosed".to_vec()]
        );
    }

    #[test]
    fn leaves_out_a_glob_that_can_never_match() {
        // Arrange
        let patterns = ["[unclosed"];

        // Act
        let result = compile_pattern_set(patterns, INCLUDE_GLOB_OPTIONS);

        // Assert
        assert!(result.globs.is_empty());
    }

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
