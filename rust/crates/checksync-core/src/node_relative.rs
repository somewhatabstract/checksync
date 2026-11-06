use std::ffi::{OsStr, OsString};
use std::path::{Component, Path, PathBuf};

use crate::node_normalize::node_normalize;

/// Find the relative path from one path to another, as Node.js's
/// `path.relative` does.
///
/// Both paths are normalized first (see [`node_normalize`]), and a relative
/// path is taken as relative to `cwd`. The result climbs out of `from` with
/// `..` as far as needed, then descends into `to`; it's empty when the two
/// are the same. On Windows, segments are compared ignoring case, and a path
/// on another drive is returned as it is, as Node.js does there.
///
/// # Arguments
///
/// * `cwd` - The absolute folder that relative paths are resolved against.
/// * `from` - The path to start from.
/// * `to` - The path to reach.
///
/// # Returns
///
/// The path from `from` to `to`.
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

/// Compare two path segments, ignoring case, as Node.js does on Windows.
#[cfg(windows)]
fn same_segment(a: &Component, b: &Component) -> bool {
    a.as_os_str().to_string_lossy().to_lowercase() == b.as_os_str().to_string_lossy().to_lowercase()
}

/// Compare two path segments exactly.
#[cfg(not(windows))]
fn same_segment(a: &Component, b: &Component) -> bool {
    a == b
}

#[cfg(test)]
mod tests {
    use std::path::{MAIN_SEPARATOR_STR, Path, PathBuf};

    use super::node_relative;

    /// Build a path from `/`-separated parts, so tests run on any platform.
    fn path(parts: &str) -> PathBuf {
        PathBuf::from(parts.replace('/', MAIN_SEPARATOR_STR))
    }

    /// An absolute folder to resolve relative paths against.
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
    fn keeps_a_segment_that_looks_like_a_drive() {
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
