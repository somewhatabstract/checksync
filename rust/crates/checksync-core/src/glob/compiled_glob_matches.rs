use super::advance_glob_positions::advance_glob_positions;
use super::bytes_before_nul::bytes_before_nul;
use super::types::CompiledGlob;

/// Check whether the whole of a text matches a compiled glob pattern.
///
/// Matching works on bytes, the way git matches its globs. `?` matches any
/// one byte, `*` any run of bytes, `[...]` one byte from a set, and `\`
/// makes the next byte literal. A NUL byte ends the text, as it would a C
/// string. `GlobOptions` describes how `pathname` and `casefold` change
/// this.
///
/// Rather than backtracking, matching tracks every position in the text
/// that the pattern so far can reach, so it takes time proportional to the
/// pattern's length times the text's, however many stars there are. It
/// stops as soon as no position is reachable.
///
/// # Arguments
///
/// * `glob` - The compiled pattern.
/// * `text` - The text to match against it.
///
/// # Returns
///
/// `true` if the pattern matches the whole text.
#[must_use]
pub(crate) fn compiled_glob_matches(glob: &CompiledGlob, text: &[u8]) -> bool {
    let text = bytes_before_nul(text);
    let mut positions = vec![false; text.len() + 1];
    positions[0] = true;
    glob.tokens
        .iter()
        .all(|token| advance_glob_positions(token, text, &mut positions, glob.options))
        && positions[text.len()]
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::super::compile_glob::compile_glob;
    use super::super::types::GlobOptions;
    use super::compiled_glob_matches;

    /// The glob vector table: what it holds, and the vectors themselves.
    #[derive(Deserialize)]
    struct Table {
        description: String,
        vectors: Vec<Vector>,
    }

    /// A group of vector cases exercising one feature of the matcher.
    #[derive(Deserialize)]
    struct Vector {
        description: String,
        cases: Vec<Case>,
    }

    /// One pattern and text, the options to match them with, and git's
    /// answer.
    #[derive(Deserialize)]
    struct Case {
        pattern: String,
        text: String,
        pathname: bool,
        casefold: bool,
        matches: bool,
    }

    /// Glob cases recorded from git's own matcher, which checksync's
    /// TypeScript doesn't use.
    const VECTORS: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../__conformance__/glob-vectors.json"
    ));

    /// The fast-glob vector table, of which these tests read the matches.
    #[derive(Deserialize)]
    struct FastGlobTable {
        description: String,
        matches: Vec<FastGlobVector>,
    }

    /// A group of fast-glob match cases exercising one feature.
    #[derive(Deserialize)]
    struct FastGlobVector {
        description: String,
        cases: Vec<FastGlobCase>,
    }

    /// One pattern and path, the `dot` option, and micromatch's answer.
    #[derive(Deserialize)]
    struct FastGlobCase {
        pattern: String,
        text: String,
        dot: bool,
        matches: bool,
        rust: Option<FastGlobDivergence>,
    }

    /// A match this implementation decides differently on purpose.
    #[derive(Deserialize)]
    struct FastGlobDivergence {
        matches: bool,
        reason: String,
    }

    /// Match cases recorded from fast-glob's micromatch, in pathname mode.
    const FAST_GLOB_VECTORS: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../__conformance__/fastglob-vectors.json"
    ));

    /// Read the fast-glob vector table.
    fn load_fast_glob_table() -> FastGlobTable {
        serde_json::from_str(FAST_GLOB_VECTORS).expect("valid fast-glob vector table")
    }

    /// Compile `pattern` and match `text` against it.
    fn matches(pattern: &[u8], text: &[u8], options: GlobOptions) -> bool {
        compiled_glob_matches(&compile_glob(pattern, options).unwrap(), text)
    }

    const PLAIN: GlobOptions = GlobOptions {
        pathname: false,
        casefold: false,
        dot: true,
    };

    const PATHNAME: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
        dot: true,
    };

    const HIDING_DOTS: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
        dot: false,
    };

    const CASEFOLD: GlobOptions = GlobOptions {
        pathname: false,
        casefold: true,
        dot: true,
    };

    #[test]
    fn matches_identical_text() {
        // Arrange
        let pattern = b"abc";

        // Act
        let result = matches(pattern, b"abc", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn requires_the_whole_text_to_match() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = matches(pattern, b"abc", PLAIN);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_empty_text_with_an_empty_pattern() {
        // Arrange
        let pattern = b"";

        // Act
        let result = matches(pattern, b"", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_one_byte_with_a_question_mark() {
        // Arrange
        let pattern = b"a?c";

        // Act
        let result = matches(pattern, b"a/c", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_run_with_a_star() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = matches(pattern, b"ab/bc", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_empty_run_with_a_star() {
        // Arrange
        let pattern = b"a*";

        // Act
        let result = matches(pattern, b"a", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_byte_from_a_bracket_set() {
        // Arrange
        let pattern = b"[[:digit:]x-z]";

        // Act
        let result = matches(pattern, b"y", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_star_literally() {
        // Arrange
        let pattern = b"a\\*";

        // Act
        let result = matches(pattern, b"ab", PLAIN);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ends_the_text_at_a_nul_byte() {
        // Arrange
        let pattern = b"ab";

        // Act
        let result = matches(pattern, b"ab\0c", PLAIN);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_slash_with_a_star_in_pathname_mode() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = matches(pattern, b"ab/c", PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_no_folders_with_a_leading_double_star() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = matches(pattern, b"x", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_several_folders_with_a_leading_double_star() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = matches(pattern, b"a/b/x", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_no_folders_with_a_middle_double_star() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/b", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_several_folders_with_a_middle_double_star() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/x/y/b", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_everything_inside_a_folder_with_a_trailing_double_star() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = matches(pattern, b"a/b/c", PATHNAME);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_the_folder_itself_with_a_trailing_double_star() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = matches(pattern, b"a", PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn treats_a_double_star_inside_a_name_as_a_single_star() {
        // Arrange
        let pattern = b"a**";

        // Act
        let result = matches(pattern, b"a/b", PATHNAME);

        // Assert
        assert!(!result);
    }

    #[test]
    fn needs_a_folder_for_a_middle_double_star_without_pathname_mode() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = matches(pattern, b"a/b", PLAIN);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_letters_in_either_case_when_folding_case() {
        // Arrange
        let pattern = b"AbC";

        // Act
        let result = matches(pattern, b"aBc", CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_a_range_in_either_case_when_folding_case() {
        // Arrange
        let pattern = b"[A-Z]";

        // Act
        let result = matches(pattern, b"q", CASEFOLD);

        // Assert
        assert!(result);
    }

    #[test]
    fn compares_non_ascii_bytes_exactly_when_folding_case() {
        // Arrange
        let pattern = b"\xc9";

        // Act
        let result = matches(pattern, b"\xe9", CASEFOLD);

        // Assert
        assert!(!result);
    }

    #[test]
    fn keeps_letter_case_without_folding_case() {
        // Arrange
        let pattern = b"abc";

        // Act
        let result = matches(pattern, b"ABC", PLAIN);

        // Assert
        assert!(!result);
    }

    /// Read the glob vector table.
    fn load_table() -> Table {
        serde_json::from_str(VECTORS).expect("valid glob vector table")
    }

    #[test]
    fn says_where_the_glob_vectors_come_from() {
        // Arrange
        let table = load_table();

        // Act
        let result = table.description.contains("git");

        // Assert
        assert!(result);
    }

    #[test]
    fn has_glob_vectors_to_check() {
        // Arrange
        let table = load_table();

        // Act
        let result = table
            .vectors
            .iter()
            .map(|vector| vector.cases.len())
            .sum::<usize>();

        // Assert
        assert_ne!(result, 0);
    }

    #[test]
    fn matches_every_glob_vector_as_git_does() {
        // Arrange
        let table = load_table();

        // Act
        let mismatches: Vec<(&str, &str, &str, GlobOptions, bool)> = table
            .vectors
            .iter()
            .flat_map(|vector| {
                vector.cases.iter().map(|case| {
                    let options = GlobOptions {
                        pathname: case.pathname,
                        casefold: case.casefold,
                        dot: true,
                    };
                    let actual = compile_glob(case.pattern.as_bytes(), options)
                        .is_some_and(|glob| compiled_glob_matches(&glob, case.text.as_bytes()));
                    let entry = (
                        vector.description.as_str(),
                        case.pattern.as_str(),
                        case.text.as_str(),
                        options,
                        case.matches,
                    );
                    (entry, actual)
                })
            })
            .filter(|&((.., expected), actual)| expected != actual)
            .map(|(entry, _)| entry)
            .collect();

        // Assert
        assert_eq!(mismatches, Vec::new());
    }

    #[test]
    fn does_not_match_a_hidden_name_with_a_star_when_hiding_dots() {
        // Arrange
        let pattern = b"a/*";

        // Act
        let result = matches(pattern, b"a/.b", HIDING_DOTS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_hidden_name_with_a_literal_dot_when_hiding_dots() {
        // Arrange
        let pattern = b"a/.*";

        // Act
        let result = matches(pattern, b"a/.b", HIDING_DOTS);

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_enter_a_hidden_folder_with_a_double_star_when_hiding_dots() {
        // Arrange
        let pattern = b"**/c";

        // Act
        let result = matches(pattern, b"a/.b/c", HIDING_DOTS);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_inside_a_named_hidden_folder_when_hiding_dots() {
        // Arrange
        let pattern = b".b/**";

        // Act
        let result = matches(pattern, b".b/c", HIDING_DOTS);

        // Assert
        assert!(result);
    }

    #[test]
    fn says_where_the_fast_glob_vectors_come_from() {
        // Arrange
        let table = load_fast_glob_table();

        // Act
        let result = table.description.contains("micromatch");

        // Assert
        assert!(result);
    }

    #[test]
    fn has_fast_glob_match_vectors_to_check() {
        // Arrange
        let table = load_fast_glob_table();

        // Act
        let result = table
            .matches
            .iter()
            .map(|vector| vector.cases.len())
            .sum::<usize>();

        // Assert
        assert_ne!(result, 0);
    }

    #[test]
    fn explains_every_fast_glob_match_divergence_and_differs_from_micromatch() {
        // Arrange
        let table = load_fast_glob_table();

        // Act
        let unexplained: Vec<(&str, &str, &str, bool)> = table
            .matches
            .iter()
            .flat_map(|vector| {
                vector.cases.iter().map(move |case| {
                    let explained = case.rust.as_ref().is_none_or(|rust| {
                        !rust.reason.trim().is_empty() && rust.matches != case.matches
                    });
                    let entry = (
                        vector.description.as_str(),
                        case.pattern.as_str(),
                        case.text.as_str(),
                        case.dot,
                    );
                    (entry, explained)
                })
            })
            .filter(|&(_, explained)| !explained)
            .map(|(entry, _)| entry)
            .collect();

        // Assert
        assert_eq!(unexplained, Vec::new());
    }

    #[test]
    fn matches_every_fast_glob_vector_as_micromatch_does_apart_from_divergences() {
        // Arrange
        let table = load_fast_glob_table();

        // Act
        let mismatches: Vec<(&str, &str, &str, bool, bool)> = table
            .matches
            .iter()
            .flat_map(|vector| {
                vector.cases.iter().map(move |case| {
                    let options = GlobOptions {
                        pathname: true,
                        casefold: false,
                        dot: case.dot,
                    };
                    let wanted = case.rust.as_ref().map_or(case.matches, |rust| rust.matches);
                    let actual = matches(case.pattern.as_bytes(), case.text.as_bytes(), options);
                    let entry = (
                        vector.description.as_str(),
                        case.pattern.as_str(),
                        case.text.as_str(),
                        case.dot,
                        wanted,
                    );
                    (entry, actual)
                })
            })
            .filter(|&((.., wanted), actual)| wanted != actual)
            .map(|(entry, _)| entry)
            .collect();

        // Assert
        assert_eq!(mismatches, Vec::new());
    }
}
