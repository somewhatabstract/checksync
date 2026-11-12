use super::matches_pattern_set::matches_pattern_set;
use super::types::PatternSet;

/// Check whether an exclude pattern prunes a task's folder or one above it.
///
/// Walking starts at the task's folder, so the folders on the way to it are
/// never visited and checked. If an exclude pattern prunes any of them, as
/// `lib` does for a task walking `lib/src`, nothing below can be found.
///
/// # Arguments
///
/// * `base` - The task's folder, relative to the working folder, with `/`
///   between names; `.` for the working folder itself.
/// * `excludes` - The compiled exclude patterns.
///
/// # Returns
///
/// Whether the task's folder is pruned.
#[must_use]
pub(super) fn is_base_excluded(base: &str, excludes: &PatternSet) -> bool {
    base != "."
        && base
            .match_indices('/')
            .map(|(slash, _)| &base[..slash])
            .chain(std::iter::once(base))
            .filter(|folder| !folder.is_empty())
            .any(|folder| matches_pattern_set(excludes, folder.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::is_base_excluded;
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
    fn prunes_a_folder_an_exclude_names() {
        // Arrange
        let excludes = excludes(&["lib"]);

        // Act
        let result = is_base_excluded("lib", &excludes);

        // Assert
        assert!(result);
    }

    #[test]
    fn prunes_a_folder_below_one_an_exclude_names() {
        // Arrange
        let excludes = excludes(&["lib"]);

        // Act
        let result = is_base_excluded("lib/src", &excludes);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_a_folder_no_exclude_names() {
        // Arrange
        let excludes = excludes(&["lib"]);

        // Act
        let result = is_base_excluded("src/lib2", &excludes);

        // Assert
        assert!(!result);
    }

    #[test]
    fn never_prunes_the_working_folder() {
        // Arrange
        let excludes = excludes(&["**"]);

        // Act
        let result = is_base_excluded(".", &excludes);

        // Assert
        assert!(!result);
    }

    #[test]
    fn checks_the_folders_of_an_absolute_base() {
        // Arrange
        let excludes = excludes(&["/a"]);

        // Act
        let result = is_base_excluded("/a/b", &excludes);

        // Assert
        assert!(result);
    }
}
