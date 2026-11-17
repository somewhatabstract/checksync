//! Path handling that matches Node.js's `path` module.

use std::ffi::{OsStr, OsString};
use std::path::{Component, Path, PathBuf};

/// Normalizes a path the way Node.js's `path.normalize` does.
///
/// `.` segments are dropped and each `..` removes the segment before it, by
/// looking at the text only, without touching the file system. A `..` at the
/// start of a relative path is kept, and one directly under the root is
/// dropped. An empty result is `.`, and a trailing separator is kept.
pub(crate) fn node_normalize(path: &Path) -> PathBuf {
    let mut parts: Vec<Component> = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => match parts.last() {
                Some(Component::Normal(_)) => {
                    parts.pop();
                }
                Some(Component::RootDir | Component::Prefix(_)) => {}
                _ => parts.push(component),
            },
            _ => parts.push(component),
        }
    }
    // Segments are added as text rather than with `PathBuf::push`, which on
    // Windows would treat a segment like `C:x` as a new drive and drop
    // everything before it.
    let mut normalized = PathBuf::new();
    let mut after_segment = false;
    for part in &parts {
        if matches!(part, Component::Prefix(_) | Component::RootDir) {
            normalized.push(part);
            after_segment = false;
        } else {
            let text = normalized.as_mut_os_string();
            if after_segment {
                text.push(std::path::MAIN_SEPARATOR_STR);
            }
            text.push(part.as_os_str());
            after_segment = true;
        }
    }
    if normalized.as_os_str().is_empty() {
        normalized.push(".");
    }
    let has_trailing_separator = path
        .as_os_str()
        .to_string_lossy()
        .ends_with(std::path::is_separator);
    let is_root = normalized.parent().is_none() && normalized.has_root();
    if has_trailing_separator && !is_root {
        normalized
            .as_mut_os_string()
            .push(std::path::MAIN_SEPARATOR_STR);
    }
    normalized
}

/// Finds the relative path from one path to another, as Node.js's `path.relative` does.
///
/// Both paths are normalized first (see [`node_normalize`]), and a relative
/// path is taken as relative to `cwd`, which is absolute. The result climbs
/// out of `from` with `..` as far as needed, then descends into `to`; it's
/// empty when the two are the same. On Windows, segments are compared
/// ignoring case, and a path on another drive is returned as it is, as
/// Node.js does there.
pub(crate) fn node_relative(cwd: &Path, from: &Path, to: &Path) -> PathBuf {
    let from = node_normalize(&cwd.join(from));
    let to = node_normalize(&cwd.join(to));
    let from: Vec<Component> = from.components().collect();
    let to: Vec<Component> = to.components().collect();
    let shared = from
        .iter()
        .zip(&to)
        .take_while(|(a, b)| same_segment(a, b))
        .count();
    // Paths on different Windows drives have no relative path between them,
    // so Node.js returns the target as it is. Elsewhere every absolute path
    // shares the root, so this can't happen.
    #[cfg(windows)]
    {
        if shared == 0 {
            return to.iter().collect();
        }
    }
    // Segments are added as text rather than with `PathBuf::push`, which on
    // Windows would treat a segment like `C:x` as a new drive and drop
    // everything before it.
    let climb = std::iter::repeat_n(OsStr::new(".."), from.len() - shared);
    let descend = to[shared..].iter().copied().map(Component::as_os_str);
    let mut relative = OsString::new();
    for segment in climb.chain(descend) {
        if !relative.is_empty() {
            relative.push(std::path::MAIN_SEPARATOR_STR);
        }
        relative.push(segment);
    }
    PathBuf::from(relative)
}

/// Compares two path segments, ignoring case, as Node.js does on Windows.
#[cfg(windows)]
fn same_segment(a: &Component, b: &Component) -> bool {
    a.as_os_str().to_string_lossy().to_lowercase() == b.as_os_str().to_string_lossy().to_lowercase()
}

/// Compares two path segments exactly.
#[cfg(not(windows))]
fn same_segment(a: &Component, b: &Component) -> bool {
    a == b
}

#[cfg(test)]
mod tests {
    use std::path::{MAIN_SEPARATOR_STR, Path, PathBuf};

    use super::{node_normalize, node_relative};

    /// Builds a path from `/`-separated parts, so tests run on any platform.
    fn path(parts: &str) -> PathBuf {
        PathBuf::from(parts.replace('/', MAIN_SEPARATOR_STR))
    }

    #[cfg(windows)]
    #[test]
    fn keeps_a_segment_that_looks_like_a_drive() {
        // Arrange
        let input = Path::new(r"C:\a\C:b");

        // Act
        let result = node_normalize(input);

        // Assert
        assert_eq!(result.as_os_str(), r"C:\a\C:b");
    }

    #[cfg(windows)]
    #[test]
    fn keeps_a_drive_relative_path_relative() {
        // Arrange
        let input = Path::new(r"C:a\.\b");

        // Act
        let result = node_normalize(input);

        // Assert
        assert_eq!(result.as_os_str(), r"C:a\b");
    }

    #[test]
    fn removes_a_segment_before_dot_dot() {
        // Arrange
        let input = path("/a/b/../c");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result, path("/a/c"));
    }

    #[test]
    fn drops_dot_segments_and_repeated_separators() {
        // Arrange
        let input = path("./a/./b//c");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result, path("a/b/c"));
    }

    #[test]
    fn keeps_dot_dot_at_the_start_of_a_relative_path() {
        // Arrange
        let input = path("a/../../b");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result, path("../b"));
    }

    #[test]
    fn drops_dot_dot_directly_under_the_root() {
        // Arrange
        let input = path("/a/b/c/../../../..");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result, path("/"));
    }

    #[test]
    fn turns_an_empty_result_into_a_dot() {
        // Arrange
        let input = path("a/b/../..");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result, Path::new("."));
    }

    #[test]
    fn keeps_a_trailing_separator() {
        // Arrange
        let input = path("/a/./b/");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result.as_os_str(), path("/a/b/").as_os_str());
    }

    #[test]
    fn keeps_the_root_without_adding_a_separator() {
        // Arrange
        let input = path("/");

        // Act
        let result = node_normalize(&input);

        // Assert
        assert_eq!(result.as_os_str(), path("/").as_os_str());
    }

    /// Returns an absolute folder to resolve relative paths against.
    fn cwd() -> PathBuf {
        std::env::temp_dir().join("cwd")
    }

    #[test]
    fn descends_into_a_path_below() {
        // Arrange
        let from = cwd().join("a");
        let to = cwd().join("a/b/c");

        // Act
        let result = node_relative(&cwd(), &from, &to);

        // Assert
        assert_eq!(result, path("b/c"));
    }

    #[test]
    fn climbs_out_of_from_then_descends() {
        // Arrange
        let from = cwd().join("a/b/c");
        let to = cwd().join("a/x");

        // Act
        let result = node_relative(&cwd(), &from, &to);

        // Assert
        assert_eq!(result, path("../../x"));
    }

    #[cfg(windows)]
    #[test]
    fn keeps_a_segment_that_looks_like_a_drive_in_a_relative_path() {
        // Arrange
        let from = Path::new(r"C:\a\x");
        let to = Path::new(r"C:\a\C:b");

        // Act
        let result = node_relative(&cwd(), from, to);

        // Assert
        assert_eq!(result.as_os_str(), r"..\C:b");
    }

    #[test]
    fn is_empty_for_the_same_path() {
        // Arrange
        let from = cwd().join("a");

        // Act
        let result = node_relative(&cwd(), &from, &from);

        // Assert
        assert_eq!(result, Path::new(""));
    }

    #[test]
    fn resolves_relative_paths_against_cwd() {
        // Arrange
        let to = Path::new("a/./b/../c");

        // Act
        let result = node_relative(&cwd(), Path::new(""), to);

        // Assert
        assert_eq!(result, path("a/c"));
    }

    #[test]
    fn ignores_a_trailing_separator() {
        // Arrange
        let from = PathBuf::from(format!("{}{MAIN_SEPARATOR_STR}", cwd().join("a").display()));
        let to = cwd().join("a/b");

        // Act
        let result = node_relative(&cwd(), &from, &to);

        // Assert
        assert_eq!(result, Path::new("b"));
    }
}
