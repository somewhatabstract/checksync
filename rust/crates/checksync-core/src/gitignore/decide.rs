//! Deciding what an ignore file's patterns say about a path.

use super::pattern::GitignorePattern;
use crate::glob::compiled_glob_matches;
use crate::types::IgnoreDecision;

/// Decides what an ignore file's patterns say about a file inside its folder.
///
/// `patterns` are the ignore file's patterns, in order, and `path` is the file's
/// path relative to the ignore file's folder, with `/` between names. Each folder
/// above the file is checked first, from the top down; if any of them is ignored,
/// so is the file, whatever the patterns say about the file itself. Otherwise the
/// last pattern matching the file decides.
#[must_use]
pub(super) fn decide_path(patterns: &[GitignorePattern], path: &[u8]) -> IgnoreDecision {
    let folder_ignored = path
        .iter()
        .enumerate()
        .filter(|&(_, &byte)| byte == b'/')
        .any(|(end, _)| last_match(patterns, &path[..end], true) == IgnoreDecision::Ignored);
    if folder_ignored {
        return IgnoreDecision::Ignored;
    }
    last_match(patterns, path, false)
}

/// Returns what the last ignore-file pattern matching a path says about it.
///
/// `patterns` are the ignore file's patterns, in order, and `path` is relative to
/// the ignore file's folder, with `/` between names; `is_folder` says whether it's
/// a folder rather than a file. Returns [`IgnoreDecision::Unignored`] if the last
/// matching pattern is negated, [`IgnoreDecision::Ignored`] if it isn't, or
/// [`IgnoreDecision::NoOpinion`] if no pattern matches.
#[must_use]
fn last_match(patterns: &[GitignorePattern], path: &[u8], is_folder: bool) -> IgnoreDecision {
    let name = path.rsplit(|&byte| byte == b'/').next().unwrap_or_default();
    match patterns
        .iter()
        .rev()
        .find(|pattern| pattern_matches(pattern, path, name, is_folder))
    {
        Some(pattern) if pattern.negated => IgnoreDecision::Unignored,
        Some(_) => IgnoreDecision::Ignored,
        None => IgnoreDecision::NoOpinion,
    }
}

/// Checks whether one ignore-file pattern matches a path.
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
fn pattern_matches(pattern: &GitignorePattern, path: &[u8], name: &[u8], is_folder: bool) -> bool {
    debug_assert_eq!(path.rsplit(|&byte| byte == b'/').next(), Some(name));
    if pattern.folders_only && !is_folder {
        return false;
    }
    let subject = if pattern.anchored { path } else { name };
    compiled_glob_matches(&pattern.glob, subject)
}

#[cfg(test)]
mod tests {
    use super::super::ignore_file::parse;
    use super::{decide_path, last_match};
    use crate::types::IgnoreDecision;

    #[test]
    fn ignores_a_file_in_an_ignored_folder_even_when_negated() {
        // Arrange
        let patterns = parse(b"logs/\n!logs/keep.log\n");

        // Act
        let result = decide_path(&patterns, b"logs/keep.log");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_file_in_an_ignored_folder_deeper_down() {
        // Arrange
        let patterns = parse(b"a/b/\n");

        // Act
        let result = decide_path(&patterns, b"a/b/c/d.js");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn decides_by_the_file_when_its_folder_is_unignored() {
        // Arrange
        let patterns = parse(b"a/*\n!a/b\n");

        // Act
        let result = decide_path(&patterns, b"a/b/x");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn decides_by_the_last_pattern_matching_the_file() {
        // Arrange
        let patterns = parse(b"logs/*\n!logs/keep.log\n");

        // Act
        let result = decide_path(&patterns, b"logs/keep.log");

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn ignores_a_name_at_the_top_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"b");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_name_deeper_down_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"x/y/b");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_folders_contents_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"b/c");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn needs_a_whole_name_with_an_anchored_leading_double_star() {
        // Arrange
        let patterns = parse(b"/**/b\n");

        // Act
        let result = decide_path(&patterns, b"ab");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn matches_within_the_first_name_with_an_anchored_joined_double_star() {
        // Arrange
        let patterns = parse(b"/a**/b\n");

        // Act
        let result = decide_path(&patterns, b"ax/b");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn does_not_cross_folders_with_an_anchored_joined_double_star() {
        // Arrange
        let patterns = parse(b"/a**/b\n");

        // Act
        let result = decide_path(&patterns, b"ax/y/b");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn anchors_a_joined_double_star_to_the_folder() {
        // Arrange
        let patterns = parse(b"/a**/b\n");

        // Act
        let result = decide_path(&patterns, b"x/a/b");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn anchors_a_pattern_whose_only_slash_is_leading() {
        // Arrange
        let patterns = parse(b"/**b\n");

        // Act
        let result = decide_path(&patterns, b"x/xb");

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn matches_a_name_at_any_depth_without_a_leading_slash() {
        // Arrange
        let patterns = parse(b"**b\n");

        // Act
        let result = decide_path(&patterns, b"x/xb");

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_a_path_matching_a_plain_pattern() {
        // Arrange
        let patterns = parse(b"*.log\n");

        // Act
        let result = last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn unignores_a_path_matching_a_negated_pattern() {
        // Arrange
        let patterns = parse(b"!a.log\n");

        // Act
        let result = last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn lets_the_last_matching_pattern_decide() {
        // Arrange
        let patterns = parse(b"*.log\n!a.log\nb.log\n");

        // Act
        let result = last_match(&patterns, b"a.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn matches_a_name_pattern_against_the_last_name() {
        // Arrange
        let patterns = parse(b"c.log\n");

        // Act
        let result = last_match(&patterns, b"a/b/c.log", false);

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn has_no_opinion_when_nothing_matches() {
        // Arrange
        let patterns = parse(b"*.log\n");

        // Act
        let result = last_match(&patterns, b"a.js", false);

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }
}

#[cfg(test)]
mod pattern_matches_tests {
    use super::super::pattern::{GLOB_OPTIONS, GitignorePattern};
    use super::pattern_matches;
    use crate::glob::compile_glob;

    fn pattern(glob: &[u8], folders_only: bool, anchored: bool) -> GitignorePattern {
        GitignorePattern {
            glob: compile_glob(glob, GLOB_OPTIONS).unwrap(),
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
        let result = pattern_matches(&pattern, b"a/b/c.log", b"c.log", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_anchored_pattern_against_the_whole_path() {
        // Arrange
        let pattern = pattern(b"c.log", false, true);

        // Act
        let result = pattern_matches(&pattern, b"a/c.log", b"c.log", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_let_a_star_cross_folders() {
        // Arrange
        let pattern = pattern(b"a/*", false, true);

        // Act
        let result = pattern_matches(&pattern, b"a/b/c", b"c", false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_ascii_case() {
        // Arrange
        let pattern = pattern(b"*.LOG", false, false);

        // Act
        let result = pattern_matches(&pattern, b"a.log", b"a.log", false);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_file_with_a_folder_pattern() {
        // Arrange
        let pattern = pattern(b"build", true, false);

        // Act
        let result = pattern_matches(&pattern, b"build", b"build", false);

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
        let _ = pattern_matches(&pattern, b"a/b", b"a", false);

        // Assert
        // The call panics.
    }

    #[test]
    fn matches_a_folder_with_a_folder_pattern() {
        // Arrange
        let pattern = pattern(b"build", true, false);

        // Act
        let result = pattern_matches(&pattern, b"build", b"build", true);

        // Assert
        assert!(result);
    }
}
