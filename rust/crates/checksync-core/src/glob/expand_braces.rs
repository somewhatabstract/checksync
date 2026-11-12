use super::bytes_before_nul::bytes_before_nul;
use super::contains_brace_group::contains_brace_group;
use super::expand_brace_pieces::expand_brace_pieces;
use super::types::{BraceBudget, BraceExpansionError};

/// The longest pattern with brace groups that `expand_braces` accepts.
///
/// micromatch's braces has a 10,000-byte limit too, but applies it to more
/// patterns, including ones with braces that form no group.
const MAX_PATTERN_LENGTH: usize = 10_000;

/// Expand the `{a,b}` brace groups in a pattern into separate patterns.
///
/// This follows the brace expansion fast-glob applies through micromatch.
/// Each group stands for each of its comma-separated alternatives in turn,
/// and groups can nest. With several groups, the earlier group varies
/// slowest. A `{` that doesn't start a group, such as in `{a}` or an
/// unclosed `{`, and a stray `}` stay literal. A `\` escapes the byte after
/// it, and braces and commas inside `[...]` don't count. Everything but the
/// groups is kept exactly as written, escapes included, so each result is
/// still a glob pattern, as fast-glob's own expanded patterns are.
///
/// Unlike micromatch, ranges such as `{1..3}` or `{a..c}` aren't expanded:
/// with no comma, they stay literal.
///
/// Duplicates, such as the two `a`s from `{a,a}`, are kept; callers that
/// need unique patterns must remove them.
///
/// A NUL byte ends the pattern, as it does for `compile_glob`, so nothing
/// after it is expanded or counted against the limits.
///
/// A pattern with no brace group always gives just itself, at any length.
/// To stay within time and memory, a pattern with groups may be at most
/// 10,000 bytes long, and its expansion may give at most what
/// `brace_results_fit` allows: 100,000 patterns and 10,000,000 bytes. Any
/// expansion within those limits is accepted, whatever order its groups
/// come in, and while working it holds at most about twice its output, as
/// `take_brace_budget` checks.
/// Groups may nest to any depth: expansion keeps its work on the heap, so
/// its use of the call stack doesn't grow with the nesting.
///
/// # Arguments
///
/// * `pattern` - The pattern to expand.
///
/// # Returns
///
/// The expanded patterns, in order. A pattern with no groups gives just
/// itself.
///
/// # Errors
///
/// `BraceExpansionError::PatternTooLong` or
/// `BraceExpansionError::TooManyResults` if the pattern is beyond one of the
/// limits.
#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "the file finder calls this, through the re-export"
    )
)]
pub(crate) fn expand_braces(pattern: &[u8]) -> Result<Vec<Vec<u8>>, BraceExpansionError> {
    let pattern = bytes_before_nul(pattern);
    if !contains_brace_group(pattern) {
        return Ok(vec![pattern.to_vec()]);
    }
    if pattern.len() > MAX_PATTERN_LENGTH {
        return Err(BraceExpansionError::PatternTooLong);
    }
    expand_brace_pieces(pattern, &mut BraceBudget::default())
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::super::types::BraceExpansionError;
    use super::{MAX_PATTERN_LENGTH, expand_braces};

    /// The fast-glob vector table, of which these tests read the expansions.
    #[derive(Deserialize)]
    struct Table {
        expansions: Vec<Vector>,
    }

    /// A group of expansion cases exercising one feature.
    #[derive(Deserialize)]
    struct Vector {
        description: String,
        cases: Vec<Case>,
    }

    /// One pattern and what micromatch expands it to, or its error.
    #[derive(Deserialize)]
    struct Case {
        pattern: String,
        expanded: Option<Vec<String>>,
        error: Option<String>,
        rust: Option<Divergence>,
    }

    /// An expansion this implementation makes differently on purpose.
    #[derive(Deserialize)]
    struct Divergence {
        expanded: Vec<String>,
        reason: String,
    }

    /// Brace expansion cases recorded from fast-glob's micromatch.
    const VECTORS: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../__conformance__/fastglob-vectors.json"
    ));

    /// Read the fast-glob vector table.
    fn load_table() -> Table {
        serde_json::from_str(VECTORS).expect("valid fast-glob vector table")
    }

    /// Expand `pattern` and turn the results into strings for comparing.
    /// What `expand` gives: the expanded patterns as strings, or the error.
    type Expansion = Result<Vec<String>, BraceExpansionError>;

    /// Turn string slices into owned strings, for comparing with `expand`.
    fn strings(items: &[&str]) -> Vec<String> {
        items.iter().map(|&item| item.to_owned()).collect()
    }

    fn expand(pattern: &str) -> Expansion {
        expand_braces(pattern.as_bytes()).map(|results| {
            results
                .iter()
                .map(|result| String::from_utf8_lossy(result).into_owned())
                .collect()
        })
    }

    #[test]
    fn keeps_a_pattern_without_groups() {
        // Arrange
        let pattern = "a*b";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["a*b"])));
    }

    #[test]
    fn keeps_an_empty_pattern() {
        // Arrange
        let pattern = "";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&[""])));
    }

    #[test]
    fn expands_a_comma_list() {
        // Arrange
        let pattern = "a{b,c}d";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["abd", "acd"])));
    }

    #[test]
    fn expands_nested_groups() {
        // Arrange
        let pattern = "a{b,c{d,e}}f";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["abf", "acdf", "acef"])));
    }

    #[test]
    fn varies_the_earlier_group_slowest() {
        // Arrange
        let pattern = "{a,b}{c,d}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["ac", "ad", "bc", "bd"])));
    }

    #[test]
    fn keeps_empty_alternatives() {
        // Arrange
        let pattern = "a{,b}c";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["ac", "abc"])));
    }

    #[test]
    fn keeps_escaped_braces_literal_and_escaped() {
        // Arrange
        let pattern = "\\{a,b}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["\\{a,b}"])));
    }

    #[test]
    fn keeps_an_escaped_comma_inside_one_alternative() {
        // Arrange
        let pattern = "{a\\,b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["a\\,b", "c"])));
    }

    #[test]
    fn keeps_a_group_without_a_comma_literal() {
        // Arrange
        let pattern = "{a}{b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["{a}b", "{a}c"])));
    }

    #[test]
    fn keeps_an_unclosed_brace_literal() {
        // Arrange
        let pattern = "x{a{b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["x{ab", "x{ac"])));
    }

    #[test]
    fn keeps_a_stray_closing_brace_literal() {
        // Arrange
        let pattern = "{a,b}c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["ac}", "bc}"])));
    }

    #[test]
    fn does_not_split_at_commas_inside_brackets() {
        // Arrange
        let pattern = "{[a,b],c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["[a,b]", "c"])));
    }

    #[test]
    fn does_not_expand_a_range() {
        // Arrange
        let pattern = "{1..3}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["{1..3}"])));
    }

    #[test]
    fn rejects_a_pattern_with_groups_that_is_too_long() {
        // Arrange
        let pattern = ["{a,b}".as_bytes(), &vec![b'x'; MAX_PATTERN_LENGTH - 4]].concat();

        // Act
        let result = expand_braces(&pattern);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::PatternTooLong));
    }

    #[test]
    fn expands_a_pattern_with_groups_as_long_as_allowed() {
        // Arrange
        let pattern = ["{a,b}".as_bytes(), &vec![b'x'; MAX_PATTERN_LENGTH - 5]].concat();

        // Act
        let result = expand_braces(&pattern).map(|results| results.len());

        // Assert
        assert_eq!(result, Ok(2));
    }

    #[test]
    fn keeps_a_long_pattern_without_groups() {
        // Arrange
        let pattern = vec![b'x'; MAX_PATTERN_LENGTH * 10];

        // Act
        let result = expand_braces(&pattern);

        // Assert
        assert_eq!(result, Ok(vec![pattern]));
    }

    #[test]
    fn keeps_many_unmatched_braces() {
        // Arrange
        let pattern = "x{".repeat(100_000);

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Ok(vec![pattern.into_bytes()]));
    }

    #[test]
    fn keeps_braces_hidden_by_brackets() {
        // Arrange
        let pattern = "[]{]".repeat(30);

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Ok(vec![pattern.into_bytes()]));
    }

    #[test]
    fn keeps_deeply_nested_braces_without_commas() {
        // Arrange
        let pattern = ["{".repeat(50_000), "}".repeat(50_000)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Ok(vec![pattern.into_bytes()]));
    }

    /// Expand `pattern` on a thread with a deliberately small stack.
    fn expand_on_small_stack(pattern: String) -> Result<usize, BraceExpansionError> {
        std::thread::Builder::new()
            .stack_size(64 * 1024)
            .spawn(move || expand_braces(pattern.as_bytes()).map(|results| results.len()))
            .unwrap()
            .join()
            .unwrap()
    }

    #[test]
    fn expands_deeply_nested_groups() {
        // Arrange
        let pattern = ["{a,".repeat(2_500), "}".repeat(2_500)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes()).map(|results| results.len());

        // Assert
        assert_eq!(result, Ok(2_501));
    }

    #[test]
    fn expands_deeply_nested_groups_on_a_small_stack() {
        // Arrange
        let pattern = ["{a,".repeat(2_500), "}".repeat(2_500)].concat();

        // Act
        let result = expand_on_small_stack(pattern);

        // Assert
        assert_eq!(result, Ok(2_501));
    }

    #[test]
    fn expands_a_group_inside_many_braces_on_a_small_stack() {
        // Arrange
        let pattern = ["{".repeat(1_500), "a,b".to_owned(), "}".repeat(1_500)].concat();

        // Act
        let result = expand_on_small_stack(pattern);

        // Assert
        assert_eq!(result, Ok(2));
    }

    #[test]
    fn keeps_deeply_nested_braces_without_commas_on_a_small_stack() {
        // Arrange
        let pattern = ["{".repeat(50_000), "}".repeat(50_000)].concat();

        // Act
        let result = expand_on_small_stack(pattern);

        // Assert
        assert_eq!(result, Ok(1));
    }

    #[test]
    fn fails_cleanly_on_a_small_stack_when_there_are_too_many_results() {
        // Arrange
        let level = [
            "{".to_owned(),
            "{a,b}".repeat(16),
            "L".repeat(60),
            ",".to_owned(),
            "{a,b}".repeat(16),
            "M".repeat(60),
        ]
        .concat();
        let pattern = [level.repeat(35), "}".repeat(35)].concat();

        // Act
        let result = expand_on_small_stack(pattern);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn rejects_an_expansion_with_too_many_results() {
        // Arrange
        let pattern = "{a,b}".repeat(30);

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn expands_exactly_as_many_results_as_allowed() {
        // Arrange
        let pattern = "{0,1,2,3,4,5,6,7,8,9}".repeat(5);

        // Act
        let result = expand_braces(pattern.as_bytes()).map(|results| results.len());

        // Assert
        assert_eq!(result, Ok(100_000));
    }

    #[test]
    fn rejects_one_group_more_than_allowed() {
        // Arrange
        let pattern = ["{0,1,2,3,4,5,6,7,8,9}".repeat(5), "{a,b}".to_owned()].concat();

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn expands_large_results_with_the_groups_at_the_end() {
        // Arrange
        let pattern = ["x".repeat(9_000), "{a,b}".repeat(10)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes()).map(|results| results.len());

        // Assert
        assert_eq!(result, Ok(1_024));
    }

    #[test]
    fn expands_large_results_with_the_groups_at_the_start() {
        // Arrange
        let pattern = ["{a,b}".repeat(10), "x".repeat(9_000)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes()).map(|results| results.len());

        // Assert
        assert_eq!(result, Ok(1_024));
    }

    #[test]
    fn rejects_results_with_too_many_bytes() {
        // Arrange
        let pattern = ["x".repeat(9_800), "{a,b}".repeat(10)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::TooManyResults));
    }

    #[test]
    fn ends_the_pattern_at_a_nul_byte() {
        // Arrange
        let pattern = "a\0{b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, Ok(strings(&["a"])));
    }

    #[test]
    fn does_not_count_groups_after_a_nul_byte_against_the_limits() {
        // Arrange
        let pattern = ["\0".to_owned(), "{a,b}".repeat(20)].concat();

        // Act
        let result = expand(&pattern);

        // Assert
        assert_eq!(result, Ok(strings(&[""])));
    }

    #[test]
    fn has_expansion_vectors_to_check() {
        // Arrange
        let table = load_table();

        // Act
        let result = table
            .expansions
            .iter()
            .map(|vector| vector.cases.len())
            .sum::<usize>();

        // Assert
        assert_ne!(result, 0);
    }

    #[test]
    fn explains_every_expansion_divergence_and_differs_from_micromatch() {
        // Arrange
        let table = load_table();

        // Act
        let unexplained: Vec<(&str, &str)> = table
            .expansions
            .iter()
            .flat_map(|vector| {
                vector.cases.iter().map(move |case| {
                    let explained = case.rust.as_ref().is_none_or(|rust| {
                        !rust.reason.trim().is_empty()
                            && Some(&rust.expanded) != case.expanded.as_ref()
                    });
                    (
                        (vector.description.as_str(), case.pattern.as_str()),
                        explained,
                    )
                })
            })
            .filter(|&(_, explained)| !explained)
            .map(|(entry, _)| entry)
            .collect();

        // Assert
        assert_eq!(unexplained, Vec::new());
    }

    #[test]
    fn expands_every_vector_as_micromatch_does_apart_from_divergences() {
        // Arrange
        let table = load_table();

        // Act
        let mismatches: Vec<(&str, &str, Expansion)> = table
            .expansions
            .iter()
            .flat_map(|vector| {
                vector.cases.iter().map(move |case| {
                    // A case with no expansion to follow expects an error.
                    let wanted = case
                        .rust
                        .as_ref()
                        .map(|rust| &rust.expanded)
                        .or(case.expanded.as_ref());
                    let actual = expand(&case.pattern);
                    // An error matches exactly when no expansion is wanted.
                    let wrong = actual.as_ref().ok() != wanted;
                    (
                        (vector.description.as_str(), case.pattern.as_str(), actual),
                        wrong,
                    )
                })
            })
            .filter(|(_, wrong)| *wrong)
            .map(|(entry, _)| entry)
            .collect();

        // Assert
        assert_eq!(mismatches, Vec::new());
    }

    #[test]
    fn records_either_an_expansion_or_an_error_for_each_vector() {
        // Arrange
        let table = load_table();

        // Act
        let unclear: Vec<&str> = table
            .expansions
            .iter()
            .flat_map(|vector| vector.cases.iter())
            .filter_map(|case| {
                (case.expanded.is_some() == case.error.is_some()).then_some(case.pattern.as_str())
            })
            .collect();

        // Assert
        assert_eq!(unclear, Vec::<&str>::new());
    }
}
