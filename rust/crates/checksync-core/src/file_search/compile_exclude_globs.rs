use std::path::Path;

use super::EXCLUDE_GLOB_OPTIONS;
use super::compile_pattern_set::compile_pattern_set;
use super::types::{ExcludeGlobs, ExcludePatterns};

/// Compile exclude patterns, keeping absolute ones apart.
///
/// Relative patterns are matched against paths relative to the working
/// folder, and absolute ones against absolute paths, as in fast-glob.
///
/// # Arguments
///
/// * `excludes` - The exclude patterns, with `/` between names.
/// * `cwd` - The absolute working folder.
///
/// # Returns
///
/// The compiled patterns.
#[must_use]
pub(super) fn compile_exclude_globs(excludes: &[String], cwd: &Path) -> ExcludeGlobs {
    let (absolute, relative): (Vec<&str>, Vec<&str>) = excludes
        .iter()
        .map(String::as_str)
        .partition(|pattern| Path::new(pattern).is_absolute());
    ExcludeGlobs {
        relative: compile_exclude_patterns(&relative),
        absolute: (!absolute.is_empty()).then(|| compile_exclude_patterns(&absolute)),
        cwd: cwd.to_path_buf(),
    }
}

/// Compile patterns for files, and the folders before any trailing `/**`.
fn compile_exclude_patterns(patterns: &[&str]) -> ExcludePatterns {
    ExcludePatterns {
        paths: compile_pattern_set(patterns.iter().copied(), EXCLUDE_GLOB_OPTIONS),
        folders: compile_pattern_set(
            patterns
                .iter()
                .filter_map(|pattern| pattern.strip_suffix("/**")),
            EXCLUDE_GLOB_OPTIONS,
        ),
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::compile_exclude_globs;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|&value| value.to_owned()).collect()
    }

    #[test]
    fn keeps_each_relative_pattern_for_paths() {
        // Arrange
        let excludes = strings(&["a/**", "b"]);

        // Act
        let result = compile_exclude_globs(&excludes, Path::new("/repo"));

        // Assert
        assert_eq!(
            result.relative.paths.literals,
            vec![b"a/**".to_vec(), b"b".to_vec()]
        );
    }

    #[test]
    fn keeps_the_folder_before_a_trailing_double_star() {
        // Arrange
        let excludes = strings(&["a/**", "b"]);

        // Act
        let result = compile_exclude_globs(&excludes, Path::new("/repo"));

        // Assert
        assert_eq!(result.relative.folders.literals, vec![b"a".to_vec()]);
    }

    #[test]
    fn has_no_absolute_patterns_when_none_are_given() {
        // Arrange
        let excludes = strings(&["a"]);

        // Act
        let result = compile_exclude_globs(&excludes, Path::new("/repo"));

        // Assert
        assert!(result.absolute.is_none());
    }

    #[cfg(unix)]
    #[test]
    fn keeps_absolute_patterns_apart() {
        // Arrange
        let excludes = strings(&["a", "/repo/**/gen/**"]);

        // Act
        let result = compile_exclude_globs(&excludes, Path::new("/repo"));

        // Assert
        assert_eq!(
            result.absolute.unwrap().paths.literals,
            vec![b"/repo/**/gen/**".to_vec()]
        );
    }
}
