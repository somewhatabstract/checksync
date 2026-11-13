use super::is_excluded::is_excluded;
use super::types::ExcludeGlobs;

/// Check whether an exclude pattern prunes a task's folder or one above it.
///
/// Walking starts at the task's folder, so the folders on the way to it are
/// never visited and checked. If an exclude pattern prunes any of them, as
/// `lib` does for a task walking `lib/src`, nothing below can be found. A
/// step up or a `.` on the way doesn't name a folder the files are in, so
/// `..` isn't checked for a task walking `../other`.
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
            .filter(|folder| {
                let name = folder.rsplit('/').next().unwrap_or(folder);
                !matches!(name, "" | "." | "..")
            })
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

    #[test]
    fn does_not_check_steps_up_on_the_way() {
        // Arrange
        let excludes = excludes(&[".."]);

        // Act
        let result = is_base_excluded("../other", &excludes);

        // Assert
        assert!(!result);
    }

    #[cfg(unix)]
    #[test]
    fn does_not_check_the_absolute_folder_a_step_up_names() {
        // Arrange
        let excludes = excludes(&["/"]);

        // Act
        let result = is_base_excluded("../../other", &excludes);

        // Assert
        assert!(!result);
    }

    #[cfg(unix)]
    #[test]
    fn prunes_a_folder_an_absolute_exclude_names_after_a_step_up() {
        // Arrange
        let excludes = excludes(&["/other"]);

        // Act
        let result = is_base_excluded("../../other", &excludes);

        // Assert
        assert!(result);
    }
}
