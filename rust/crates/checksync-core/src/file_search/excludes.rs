//! Exclude patterns, and checking whether they remove a path.

use std::path::{Path, PathBuf};

use crate::node_path::node_normalize;

use super::EXCLUDE_GLOB_OPTIONS;
use super::glob_text::glob_text;
use super::pattern_set::{PatternSet, compile_pattern_set, matches_pattern_set};

/// Exclude patterns compiled for checking files and folders.
#[derive(Debug, Clone, Default)]
struct ExcludePatterns {
    /// The patterns as given.
    ///
    /// They remove a file or prune a folder whose path they match.
    paths: PatternSet,
    /// The folder before each trailing `/**`.
    ///
    /// It prunes a folder whose path it matches, with everything in it.
    folders: PatternSet,
}

/// The compiled exclude patterns, with absolute ones kept apart.
#[derive(Debug, Clone, Default)]
pub(super) struct ExcludeGlobs {
    /// The relative patterns.
    ///
    /// They're matched against paths relative to the working folder.
    relative: ExcludePatterns,
    /// The absolute patterns, if there are any.
    ///
    /// They're matched against absolute paths.
    absolute: Option<ExcludePatterns>,
    /// The absolute working folder, for making paths absolute.
    cwd: PathBuf,
}

/// Compiles exclude patterns, keeping absolute ones apart.
///
/// Relative patterns are matched against paths relative to `cwd`, the
/// absolute working folder, and absolute ones against absolute paths, as in
/// fast-glob. The patterns have `/` between names.
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

/// Compiles patterns for files, and the folders before any trailing `/**`.
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

/// Checks whether an exclude pattern removes a file or prunes a folder.
///
/// `text` is the path's text, relative to the working folder or absolute,
/// and `folder` says whether the path is a folder. Relative patterns are
/// matched against the path's text, and absolute ones against its absolute
/// path. A pattern ending in `/**` also prunes the folder before it, so
/// `node_modules/**` prunes `node_modules`.
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

/// Turns a path's glob text into the glob text of its absolute path.
///
/// The text is resolved against `cwd`, the absolute working folder, the way
/// Node.js's `path.resolve` does, so `.` and `..` names are worked out and an
/// absolute text stays as it is. As in fast-glob, absolute exclude patterns
/// are matched against this form of a path. Both texts have `/` between
/// names.
#[must_use]
fn absolute_glob_text(cwd: &Path, text: &[u8]) -> Vec<u8> {
    let path = node_normalize(&cwd.join(text_path(text)));
    let absolute = glob_text(path.as_os_str()).into_owned();
    #[cfg(windows)]
    let absolute = absolute
        .into_iter()
        .map(|byte| if byte == b'\\' { b'/' } else { byte })
        .collect();
    absolute
}

/// Turns glob text back into a path.
fn text_path(text: &[u8]) -> PathBuf {
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        std::ffi::OsStr::from_bytes(text).into()
    }
    #[cfg(not(unix))]
    {
        String::from_utf8_lossy(text).into_owned().into()
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{ExcludeGlobs, absolute_glob_text, compile_exclude_globs, is_excluded};

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

    #[cfg(unix)]
    #[test]
    fn joins_a_relative_text_to_the_working_folder() {
        // Arrange
        let text = b"src/a.js";

        // Act
        let result = absolute_glob_text(Path::new("/repo"), text);

        // Assert
        assert_eq!(result, b"/repo/src/a.js");
    }

    #[cfg(unix)]
    #[test]
    fn works_out_parent_folders() {
        // Arrange
        let text = b"../lib/./a.js";

        // Act
        let result = absolute_glob_text(Path::new("/repo/src"), text);

        // Assert
        assert_eq!(result, b"/repo/lib/a.js");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_an_absolute_text() {
        // Arrange
        let text = b"/other/a.js";

        // Act
        let result = absolute_glob_text(Path::new("/repo"), text);

        // Assert
        assert_eq!(result, b"/other/a.js");
    }

    #[cfg(windows)]
    #[test]
    fn uses_forward_slashes_on_windows() {
        // Arrange
        let text = b"../lib/a.js";

        // Act
        let result = absolute_glob_text(Path::new("C:\\repo\\src"), text);

        // Assert
        assert_eq!(result, b"C:/repo/lib/a.js");
    }
}
