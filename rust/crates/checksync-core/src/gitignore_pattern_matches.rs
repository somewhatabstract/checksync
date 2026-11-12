use crate::glob_matches::glob_matches;
use crate::types::{GitignorePattern, GlobOptions};

/// The options every ignore-file glob is matched with.
const OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: true,
};

/// Check whether one ignore-file pattern matches a path.
///
/// An anchored pattern is matched against the whole path, and any other
/// pattern against the last name in it. ASCII case is always ignored.
///
/// # Arguments
///
/// * `pattern` - The pattern.
/// * `path` - The path relative to the ignore file's folder, with `/`
///   between names.
/// * `is_folder` - Whether the path is a folder rather than a file.
///
/// # Returns
///
/// `true` if the pattern matches the path.
#[must_use]
pub(crate) fn gitignore_pattern_matches(
    pattern: &GitignorePattern,
    path: &[u8],
    is_folder: bool,
) -> bool {
    if pattern.folders_only && !is_folder {
        return false;
    }
    let subject = if pattern.anchored {
        path
    } else {
        path.rsplit(|&byte| byte == b'/').next().unwrap_or_default()
    };
    glob_matches(&pattern.glob, subject, OPTIONS)
}

#[cfg(test)]
mod tests {
    use super::gitignore_pattern_matches;
    use crate::types::GitignorePattern;

    fn pattern(glob: &[u8], folders_only: bool, anchored: bool) -> GitignorePattern {
        GitignorePattern {
            glob: glob.to_vec(),
            negated: false,
            folders_only,
            anchored,
        }
    }

    #[test]
    fn matches_a_name_pattern_against_the_last_name() {
        // Arrange
        let pattern = pattern(b"*.log", false, false);

        // Act
        let result = gitignore_pattern_matches(&pattern, b"a/b/c.log", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_anchored_pattern_against_the_whole_path() {
        // Arrange
        let pattern = pattern(b"c.log", false, true);

        // Act
        let result = gitignore_pattern_matches(&pattern, b"a/c.log", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_let_a_star_cross_folders() {
        // Arrange
        let pattern = pattern(b"a/*", false, true);

        // Act
        let result = gitignore_pattern_matches(&pattern, b"a/b/c", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_ascii_case() {
        // Arrange
        let pattern = pattern(b"*.LOG", false, false);

        // Act
        let result = gitignore_pattern_matches(&pattern, b"a.log", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_file_with_a_folder_pattern() {
        // Arrange
        let pattern = pattern(b"build", true, false);

        // Act
        let result = gitignore_pattern_matches(&pattern, b"build", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_folder_with_a_folder_pattern() {
        // Arrange
        let pattern = pattern(b"build", true, false);

        // Act
        let result = gitignore_pattern_matches(&pattern, b"build", true);

        // Assert
        assert!(result);
    }
}
