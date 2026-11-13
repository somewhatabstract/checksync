use super::is_excluded::is_excluded;
use super::types::ExcludeGlobs;

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
pub(super) fn is_base_excluded(base: &str, excludes: &ExcludeGlobs) -> bool {
    base != "."
        && base
            .match_indices('/')
            .map(|(slash, _)| &base[..slash])
            .chain(std::iter::once(base))
            .filter(|folder| !folder.is_empty())
            .any(|folder| is_excluded(excludes, folder.as_bytes(), true))
}

#[cfg(test)]
mod tests {
    use super::is_base_excluded;
    use std::path::Path;

    use crate::file_search::compile_exclude_globs::compile_exclude_globs;
    use crate::file_search::types::ExcludeGlobs;

    fn excludes(patterns: &[&str]) -> ExcludeGlobs {
        let patterns: Vec<String> = patterns.iter().map(|&pattern| pattern.to_owned()).collect();
        compile_exclude_globs(&patterns, Path::new("/repo"))
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
