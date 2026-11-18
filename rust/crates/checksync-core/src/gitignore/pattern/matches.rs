//! Matching an ignore-file pattern against a path.

use super::GitignorePattern;

impl GitignorePattern {
    /// Checks whether this pattern matches a path.
    ///
    /// `path` is relative to the ignore file's folder, with `/` between names, and
    /// `is_folder` says whether it's a folder rather than a file. `name` is the last
    /// name in `path`, worked out once by the caller for all the patterns: exactly
    /// what follows the last `/` in `path`, or all of `path` if it has no `/`. An
    /// anchored pattern is matched against the whole path, and any other pattern
    /// against `name`.
    ///
    /// # Panics
    ///
    /// In debug builds, panics if `name` isn't the last name in `path`.
    #[must_use]
    pub(in crate::gitignore) fn matches(&self, path: &[u8], name: &[u8], is_folder: bool) -> bool {
        debug_assert_eq!(path.rsplit(|&byte| byte == b'/').next(), Some(name));
        if self.folders_only && !is_folder {
            return false;
        }
        let subject = if self.anchored { path } else { name };
        self.glob.matches(subject)
    }
}

#[cfg(test)]
mod tests {
    use super::super::{GLOB_OPTIONS, GitignorePattern};
    use crate::glob::CompiledGlob;

    fn pattern(glob: &[u8], folders_only: bool, anchored: bool) -> GitignorePattern {
        GitignorePattern {
            glob: CompiledGlob::try_new(glob, GLOB_OPTIONS).unwrap(),
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
        let result = pattern.matches(b"a/b/c.log", b"c.log", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_anchored_pattern_against_the_whole_path() {
        // Arrange
        let pattern = pattern(b"c.log", false, true);

        // Act
        let result = pattern.matches(b"a/c.log", b"c.log", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_let_a_star_cross_folders() {
        // Arrange
        let pattern = pattern(b"a/*", false, true);

        // Act
        let result = pattern.matches(b"a/b/c", b"c", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_ascii_case() {
        // Arrange
        let pattern = pattern(b"*.LOG", false, false);

        // Act
        let result = pattern.matches(b"a.log", b"a.log", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_file_with_a_folder_pattern() {
        // Arrange
        let pattern = pattern(b"build", true, false);

        // Act
        let result = pattern.matches(b"build", b"build", false);

        // Assert
        assert!(!result);
    }

    #[test]
    #[cfg(debug_assertions)]
    #[should_panic(expected = "assertion")]
    fn rejects_a_name_that_is_not_the_last_name_in_debug_builds() {
        // Arrange
        let pattern = pattern(b"a", false, false);

        // Act
        let _ = pattern.matches(b"a/b", b"a", false);

        // Assert
        // The call panics.
    }

    #[test]
    fn matches_a_folder_with_a_folder_pattern() {
        // Arrange
        let pattern = pattern(b"build", true, false);

        // Act
        let result = pattern.matches(b"build", b"build", true);

        // Assert
        assert!(result);
    }
}
