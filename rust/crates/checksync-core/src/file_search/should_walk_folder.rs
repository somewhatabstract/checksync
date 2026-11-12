use super::matches_pattern_set::matches_pattern_set;
use super::types::PatternSet;

/// Decide whether a folder found while walking could hold matching files.
///
/// A hidden folder is skipped unless the pattern names something hidden,
/// since wildcards never match inside one. A folder already as deep as the
/// pattern allows is skipped, since its files would be too deep. A folder an
/// exclude pattern prunes is skipped too.
///
/// # Arguments
///
/// * `text` - The folder's text, relative to the working folder.
/// * `name` - The folder's own name.
/// * `excludes` - The compiled exclude patterns.
/// * `name_limit` - How many names deep a matching file can be, if limited.
/// * `enter_hidden` - Whether the pattern names something hidden.
///
/// # Returns
///
/// Whether to walk the folder.
#[must_use]
pub(super) fn should_walk_folder(
    text: &[u8],
    name: &[u8],
    excludes: &PatternSet,
    name_limit: Option<usize>,
    enter_hidden: bool,
) -> bool {
    let can_enter = enter_hidden || !name.starts_with(b".");
    let too_deep =
        name_limit.is_some_and(|limit| text.split(|&byte| byte == b'/').count() >= limit);
    can_enter && !too_deep && !matches_pattern_set(excludes, text)
}

#[cfg(test)]
mod tests {
    use super::should_walk_folder;
    use crate::file_search::EXCLUDE_GLOB_OPTIONS;
    use crate::file_search::compile_pattern_set::compile_pattern_set;
    use crate::file_search::folder_exclude_forms::folder_exclude_forms;
    use crate::file_search::types::PatternSet;

    fn excludes(patterns: &[&str]) -> PatternSet {
        compile_pattern_set(
            patterns
                .iter()
                .flat_map(|pattern| folder_exclude_forms(pattern)),
            EXCLUDE_GLOB_OPTIONS,
        )
    }

    #[test]
    fn walks_an_ordinary_folder() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src", b"src", &excludes, None, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn skips_a_hidden_folder_when_the_pattern_names_nothing_hidden() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src/.git", b".git", &excludes, None, false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn walks_a_hidden_folder_when_the_pattern_names_something_hidden() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b".dotdir", b".dotdir", &excludes, None, true);

        // Assert
        assert!(result);
    }

    #[test]
    fn skips_a_folder_as_deep_as_the_pattern_allows() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src/nested", b"nested", &excludes, Some(2), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn walks_a_folder_shallower_than_the_limit() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src", b"src", &excludes, Some(2), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn skips_an_excluded_folder() {
        // Arrange
        let excludes = excludes(&["node_modules/**"]);

        // Act
        let result = should_walk_folder(b"node_modules", b"node_modules", &excludes, None, false);

        // Assert
        assert!(!result);
    }
}
