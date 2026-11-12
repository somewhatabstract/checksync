use crate::glob_matches::glob_matches;
use crate::types::{GitignorePattern, GlobOptions};

/// Compare two byte strings, ignoring ASCII case when asked.
fn same(a: &[u8], b: &[u8], casefold: bool) -> bool {
    if casefold {
        a.eq_ignore_ascii_case(b)
    } else {
        a == b
    }
}

/// Check whether a `.gitignore` pattern matches a path, as git does.
///
/// A folder-only pattern only matches a folder. A pattern with no `/`
/// matches the path's last part, and any other pattern matches the whole
/// path, with a leading `/` only anchoring it. As in git, the literal text
/// at the start of a pattern is compared first, and the rest is matched as a
/// glob along with the literal text's last character. Since git 2.52, that
/// last character is kept so a `**` straight after literal text, as in
/// `a**/b`, isn't mistaken for a whole folder name, so it doesn't match
/// `a/x/b`.
///
/// # Arguments
///
/// * `pattern` - The pattern.
/// * `path` - The path, relative to the ignore file's folder, using `/`.
/// * `is_dir` - Whether the path is a folder.
/// * `casefold` - Whether to ignore case, for ASCII letters only.
///
/// # Returns
///
/// Whether the pattern matches. A negated pattern matching means the path
/// is unignored.
#[must_use]
pub(crate) fn gitignore_pattern_matches(
    pattern: &GitignorePattern,
    path: &[u8],
    is_dir: bool,
    casefold: bool,
) -> bool {
    if pattern.dir_only && !is_dir {
        return false;
    }
    let mut glob = pattern.pattern.as_slice();
    let mut prefix = pattern.literal_prefix;
    if pattern.basename_only {
        let name = path.rsplit(|&byte| byte == b'/').next().unwrap_or_default();
        return if prefix == glob.len() {
            same(glob, name, casefold)
        } else if pattern.ends_with {
            let tail = &glob[1..];
            tail.len() <= name.len() && same(tail, &name[name.len() - tail.len()..], casefold)
        } else {
            glob_matches(
                glob,
                name,
                GlobOptions {
                    pathname: false,
                    casefold,
                },
            )
        };
    }
    if let Some(rest) = glob.strip_prefix(b"/") {
        glob = rest;
        prefix -= 1;
    }
    if path.is_empty() || prefix > path.len() || !same(&glob[..prefix], &path[..prefix], casefold) {
        return false;
    }
    let keep = prefix.saturating_sub(1);
    glob_matches(
        &glob[keep..],
        &path[keep..],
        GlobOptions {
            pathname: true,
            casefold,
        },
    )
}

#[cfg(test)]
mod tests {
    use super::gitignore_pattern_matches;
    use crate::parse_gitignore_pattern::parse_gitignore_pattern;

    /// Whether `line` matches `path` as a file, ignoring case.
    fn matches(line: &str, path: &str) -> bool {
        gitignore_pattern_matches(
            &parse_gitignore_pattern(line.as_bytes()),
            path.as_bytes(),
            false,
            true,
        )
    }

    #[test]
    fn matches_a_name_at_any_depth() {
        // Arrange
        let line = "a.log";

        // Act
        let result = [matches(line, "a.log"), matches(line, "x/y/a.log")];

        // Assert
        assert_eq!(result, [true, true]);
    }

    #[test]
    fn compares_a_plain_name_ignoring_case_when_asked() {
        // Arrange
        let pattern = parse_gitignore_pattern(b"A.LOG");

        // Act
        let result = [
            gitignore_pattern_matches(&pattern, b"a.log", false, true),
            gitignore_pattern_matches(&pattern, b"a.log", false, false),
        ];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_the_end_of_a_name_with_an_asterisk_and_literal_text() {
        // Arrange
        let line = "*.log";

        // Act
        let result = [
            matches(line, "x/a.log"),
            matches(line, "a.txt"),
            matches(line, "og"),
        ];

        // Assert
        assert_eq!(result, [true, false, false]);
    }

    #[test]
    fn matches_a_name_with_a_glob() {
        // Arrange
        let line = "a?.log";

        // Act
        let result = [matches(line, "x/ab.log"), matches(line, "a.log")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn only_matches_a_folder_with_a_folder_pattern() {
        // Arrange
        let pattern = parse_gitignore_pattern(b"build/");

        // Act
        let result = [
            gitignore_pattern_matches(&pattern, b"build", true, true),
            gitignore_pattern_matches(&pattern, b"build", false, true),
        ];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_a_pattern_with_a_slash_against_the_whole_path() {
        // Arrange
        let line = "a/*.js";

        // Act
        let result = [matches(line, "a/x.js"), matches(line, "b/a/x.js")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn anchors_a_pattern_with_a_leading_slash() {
        // Arrange
        let line = "/build";

        // Act
        let result = [matches(line, "build"), matches(line, "x/build")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_a_literal_path_without_a_glob() {
        // Arrange
        let line = "a/b";

        // Act
        let result = [
            matches(line, "a/b"),
            matches(line, "a/bc"),
            matches(line, "a"),
        ];

        // Assert
        assert_eq!(result, [true, false, false]);
    }

    #[test]
    fn does_not_treat_a_double_asterisk_after_literal_text_as_a_folder() {
        // Arrange
        let line = "a**/b";

        // Act
        let result = [matches(line, "a/x/b"), matches(line, "ax/b")];

        // Assert
        assert_eq!(result, [false, true]);
    }

    #[test]
    fn keeps_the_literal_character_after_a_leading_slash() {
        // Arrange
        let line = "/a**/b";

        // Act
        let result = [matches(line, "a/x/b"), matches(line, "ax/b")];

        // Assert
        assert_eq!(result, [false, true]);
    }

    #[test]
    fn matches_any_folders_with_a_double_asterisk_after_a_leading_slash() {
        // Arrange
        let line = "/**/b";

        // Act
        let result = [matches(line, "b"), matches(line, "x/y/b")];

        // Assert
        assert_eq!(result, [true, true]);
    }

    #[test]
    fn matches_any_folders_with_a_double_asterisk_after_a_literal_folder() {
        // Arrange
        let line = "a/**/b";

        // Act
        let result = [matches(line, "a/b"), matches(line, "a/x/y/b")];

        // Assert
        assert_eq!(result, [true, true]);
    }

    #[test]
    fn compares_the_literal_start_ignoring_case_when_asked() {
        // Arrange
        let pattern = parse_gitignore_pattern(b"A/*");

        // Act
        let result = [
            gitignore_pattern_matches(&pattern, b"a/x", false, true),
            gitignore_pattern_matches(&pattern, b"a/x", false, false),
        ];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_nothing_with_an_empty_path() {
        // Arrange
        let line = "*/x";

        // Act
        let result = matches(line, "");

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_glob_from_the_start_without_a_literal_prefix() {
        // Arrange
        let line = "*/x";

        // Act
        let result = [matches(line, "a/x"), matches(line, "a/b/x")];

        // Assert
        assert_eq!(result, [true, false]);
    }
}
