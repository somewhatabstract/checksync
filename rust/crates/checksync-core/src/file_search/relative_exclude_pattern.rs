use std::path::Path;

use crate::node_relative::node_relative;
use crate::normalize_separators::normalize_separators;

use super::glob_base::glob_base;

/// Rewrite an absolute exclude pattern relative to the working folder.
///
/// Paths found from relative include patterns are matched by their text
/// relative to the working folder, so an absolute exclude pattern needs a
/// relative form to match them. The pattern's folder before any glob
/// characters is plain text, so it can be made relative and the rest kept.
///
/// # Arguments
///
/// * `pattern` - The absolute exclude pattern, with `/` between names.
/// * `cwd` - The absolute working folder.
///
/// # Returns
///
/// The pattern relative to the working folder, with `/` between names.
#[must_use]
pub(super) fn relative_exclude_pattern(pattern: &str, cwd: &Path) -> String {
    let base = glob_base(pattern);
    let rest = pattern[base.len()..].trim_start_matches('/');
    let relative = node_relative(cwd, cwd, Path::new(&base));
    let relative = normalize_separators(&relative.to_string_lossy());
    if relative.is_empty() {
        rest.to_owned()
    } else {
        format!("{relative}/{rest}")
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::relative_exclude_pattern;

    // These paths are only absolute on Unix; Windows has its own test below.
    #[cfg(unix)]
    #[test]
    fn rewrites_a_pattern_below_the_working_folder() {
        // Arrange
        let cwd = Path::new("/repo");

        // Act
        let result = relative_exclude_pattern("/repo/src/**", cwd);

        // Assert
        assert_eq!(result, "src/**");
    }

    #[cfg(unix)]
    #[test]
    fn rewrites_a_pattern_for_the_working_folder_itself() {
        // Arrange
        let cwd = Path::new("/repo");

        // Act
        let result = relative_exclude_pattern("/repo/*.js", cwd);

        // Assert
        assert_eq!(result, "*.js");
    }

    #[cfg(unix)]
    #[test]
    fn rewrites_a_pattern_outside_the_working_folder() {
        // Arrange
        let cwd = Path::new("/repo/src");

        // Act
        let result = relative_exclude_pattern("/repo/lib/**", cwd);

        // Assert
        assert_eq!(result, "../lib/**");
    }

    #[cfg(unix)]
    #[test]
    fn rewrites_a_pattern_directly_under_the_root() {
        // Arrange
        let cwd = Path::new("/repo");

        // Act
        let result = relative_exclude_pattern("/*.js", cwd);

        // Assert
        assert_eq!(result, "../*.js");
    }

    #[cfg(windows)]
    #[test]
    fn rewrites_a_pattern_below_the_working_folder_on_windows() {
        // Arrange
        let cwd = Path::new("C:\\repo");

        // Act
        let result = relative_exclude_pattern("C:/repo/src/**", cwd);

        // Assert
        assert_eq!(result, "src/**");
    }
}
