//! Deciding which folders a walk needs to enter.

use super::excludes::ExcludeGlobs;

/// Decides whether a folder found while walking could hold matching files.
///
/// `text` is the folder's text, relative to the working folder, and `name` is
/// its own name. A hidden folder is skipped unless `enter_hidden` says the
/// pattern names something hidden, since wildcards never match inside one. A
/// folder already as deep as `name_limit` allows is skipped, since its files
/// would be too deep. A folder an exclude pattern prunes is skipped too.
#[must_use]
pub(super) fn should_walk_folder(
    text: &[u8],
    name: &[u8],
    excludes: &ExcludeGlobs,
    name_limit: Option<usize>,
    enter_hidden: bool,
) -> bool {
    let can_enter = enter_hidden || !name.starts_with(b".");
    let too_deep =
        name_limit.is_some_and(|limit| text.split(|&byte| byte == b'/').count() >= limit);
    can_enter && !too_deep && !excludes.is_excluded(text, true)
}

/// Finds how many names deep a pattern's files can be, if there's a limit.
///
/// The pattern has `/` between names. Without `**`, each name in a pattern
/// matches exactly one name in a path, so a file can't be deeper than the
/// pattern has names, and walking can stop there. With `**`, files can be any
/// depth, so this returns `None`.
#[must_use]
pub(super) fn pattern_name_limit(pattern: &str) -> Option<usize> {
    if pattern.contains("**") {
        None
    } else {
        Some(pattern.split('/').count())
    }
}

/// Checks whether a pattern names a hidden folder, so hidden folders matter.
///
/// The pattern has `/` between names. Wildcards never match a `.` that starts
/// a name, so only a folder name in the pattern that starts with a literal or
/// escaped `.`, or with a bracket set that may match one, can match a hidden
/// folder. The last name is a file's, so it doesn't count, and nor do the
/// names `.` and `..`, which never name a hidden folder.
#[must_use]
pub(super) fn pattern_names_hidden(pattern: &str) -> bool {
    let folders = pattern.rsplit_once('/').map_or("", |(folders, _)| folders);
    folders.split('/').any(|name| {
        (name.starts_with('.') && name != "." && name != "..")
            || name.starts_with("\\.")
            || bracket_may_match_dot(name)
    })
}

/// Checks whether a name starts with a bracket set that may match a `.`.
///
/// A set that isn't negated may match a `.` when it lists one or has a range
/// that covers one. A character class or an escape is taken to match one
/// too, as this only decides whether hidden folders are worth walking, so it
/// errs towards yes.
#[must_use]
fn bracket_may_match_dot(name: &str) -> bool {
    let Some(set) = name.strip_prefix('[') else {
        return false;
    };
    if set.starts_with(['!', '^']) {
        return false;
    }
    // A `]` straight after the `[` is part of the set, not its end.
    let body_end = set
        .char_indices()
        .skip(1)
        .find(|&(_, character)| character == ']')
        .map_or(set.len(), |(index, _)| index);
    let body: Vec<char> = set[..body_end].chars().collect();
    let mut index = 0;
    while index < body.len() {
        let character = body[index];
        if matches!(character, '.' | '[' | '\\') {
            return true;
        }
        // A range such as `a-z` is three characters: its start, `-` and its
        // end. Anything else is one character.
        if body.get(index + 1) == Some(&'-')
            && let Some(&end) = body.get(index + 2)
        {
            if (character..=end).contains(&'.') {
                return true;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        bracket_may_match_dot, pattern_name_limit, pattern_names_hidden, should_walk_folder,
    };
    use crate::file_search::excludes::ExcludeGlobs;

    fn excludes(patterns: &[&str]) -> ExcludeGlobs {
        let patterns: Vec<String> = patterns.iter().map(|&pattern| pattern.to_owned()).collect();
        ExcludeGlobs::new(&patterns, Path::new("/repo"))
    }

    #[test]
    fn walks_an_ordinary_folder() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src", b"src", &excludes, None, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn skips_a_hidden_folder_when_the_pattern_names_nothing_hidden() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src/.git", b".git", &excludes, None, false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn walks_a_hidden_folder_when_the_pattern_names_something_hidden() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b".dotdir", b".dotdir", &excludes, None, true);

        // Assert
        assert!(result);
    }

    #[test]
    fn skips_a_folder_as_deep_as_the_pattern_allows() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src/nested", b"nested", &excludes, Some(2), false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn walks_a_folder_shallower_than_the_limit() {
        // Arrange
        let excludes = excludes(&[]);

        // Act
        let result = should_walk_folder(b"src", b"src", &excludes, Some(2), false);

        // Assert
        assert!(result);
    }

    #[test]
    fn skips_an_excluded_folder() {
        // Arrange
        let excludes = excludes(&["node_modules/**"]);

        // Act
        let result = should_walk_folder(b"node_modules", b"node_modules", &excludes, None, false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn limits_a_pattern_to_its_number_of_names() {
        // Arrange
        let pattern = "src/*/a.js";

        // Act
        let result = pattern_name_limit(pattern);

        // Assert
        assert_eq!(result, Some(3));
    }

    #[test]
    fn has_no_limit_with_a_double_star() {
        // Arrange
        let pattern = "src/**/a.js";

        // Act
        let result = pattern_name_limit(pattern);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn counts_a_single_name() {
        // Arrange
        let pattern = "*.js";

        // Act
        let result = pattern_name_limit(pattern);

        // Assert
        assert_eq!(result, Some(1));
    }

    #[test]
    fn finds_a_hidden_folder_name() {
        // Arrange
        let pattern = ".dotdir/**";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_hidden_file_name() {
        // Arrange
        let pattern = "**/.gitignore";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_nothing_hidden_in_a_wildcard_pattern() {
        // Arrange
        let pattern = "src/**/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_count_parent_or_current_folders() {
        // Arrange
        let pattern = "../src/./*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_a_bracket_set_that_may_match_a_dot() {
        // Arrange
        let pattern = "[.]dotdir/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_count_a_negated_bracket_set() {
        // Arrange
        let pattern = "[!a]dotdir/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_bracket_set_in_a_file_name() {
        // Arrange
        let pattern = "**/[.]x.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_bracket_set_that_cannot_match_a_dot() {
        // Arrange
        let pattern = "[A-Z]*/x.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_an_escaped_dot_at_the_start_of_a_folder_name() {
        // Arrange
        let pattern = "\\.c*/*.js";

        // Act
        let result = pattern_names_hidden(pattern);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_set_listing_a_dot() {
        // Arrange
        let name = "[._]config";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_set_with_a_range() {
        // Arrange
        let name = "[+-/]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_set_with_a_character_class() {
        // Arrange
        let name = "[[:punct:]]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_an_escaped_character_in_a_set() {
        // Arrange
        let name = "[\\.]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_range_that_does_not_cover_a_dot() {
        // Arrange
        let name = "[A-Z]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_set_without_a_dot() {
        // Arrange
        let name = "[abc]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_dot_after_the_set() {
        // Arrange
        let name = "[]a].x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_negated_set() {
        // Arrange
        let name = "[!.]x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_a_name_without_a_set() {
        // Arrange
        let name = "x";

        // Act
        let result = bracket_may_match_dot(name);

        // Assert
        assert!(!result);
    }
}
