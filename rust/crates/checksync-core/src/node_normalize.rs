use std::path::{Component, Path, PathBuf};

/// Normalize a path the way Node.js's `path.normalize` does.
///
/// `.` segments are dropped and each `..` removes the segment before it, by
/// looking at the text only, without touching the file system. A `..` at the
/// start of a relative path is kept, and one directly under the root is
/// dropped. An empty result is `.`, and a trailing separator is kept.
///
/// # Arguments
///
/// * `path` - The path to normalize.
///
/// # Returns
///
/// The normalized path.
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
    let mut normalized: PathBuf = parts.iter().collect();
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

#[cfg(test)]
mod tests {
    use std::path::{MAIN_SEPARATOR_STR, Path, PathBuf};

    use super::node_normalize;

    /// Build a path from `/`-separated parts, so tests run on any platform.
    fn path(parts: &str) -> PathBuf {
        PathBuf::from(parts.replace('/', MAIN_SEPARATOR_STR))
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
}
