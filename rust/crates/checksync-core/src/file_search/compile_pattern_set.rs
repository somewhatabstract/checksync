use crate::glob::{GlobOptions, compile_glob};

use super::types::PatternSet;

/// Compile patterns into a set that matches a path as a glob or by its text.
///
/// # Arguments
///
/// * `patterns` - The patterns, relative to the working folder.
/// * `options` - How to match the patterns as globs.
///
/// # Returns
///
/// The pattern set.
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

#[cfg(test)]
mod tests {
    use super::compile_pattern_set;
    use crate::file_search::INCLUDE_GLOB_OPTIONS;

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
}
