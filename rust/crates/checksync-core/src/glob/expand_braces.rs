use super::brace_nesting_depth::brace_nesting_depth;
use super::expand_brace_pieces::expand_brace_pieces;
use super::types::BraceExpansionError;

/// The longest pattern `expand_braces` accepts, as in micromatch's braces.
const MAX_PATTERN_LENGTH: usize = 10_000;

/// The deepest brace nesting `expand_braces` accepts.
const MAX_NESTING: usize = 64;

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
/// To stay within time and memory, a pattern may be at most 10,000 bytes
/// long, its braces may nest at most 64 deep (counting every `{`, as
/// `brace_nesting_depth` does), and the expansion may give at most what
/// `brace_output_fits` allows: 100,000 patterns and 10,000,000 bytes.
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
/// `BraceExpansionError::PatternTooLong`, `BraceExpansionError::NestedTooDeeply`
/// or `BraceExpansionError::TooManyResults` if the pattern is beyond one of
/// the limits.
#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "the file finder will call this, through a re-export added then"
    )
)]
pub(crate) fn expand_braces(pattern: &[u8]) -> Result<Vec<Vec<u8>>, BraceExpansionError> {
    if pattern.len() > MAX_PATTERN_LENGTH {
        return Err(BraceExpansionError::PatternTooLong);
    }
    if brace_nesting_depth(pattern) > MAX_NESTING {
        return Err(BraceExpansionError::NestedTooDeeply);
    }
    expand_brace_pieces(pattern)
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::super::types::BraceExpansionError;
    use super::{MAX_NESTING, MAX_PATTERN_LENGTH, expand_braces};

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

    /// One pattern and what micromatch expands it to.
    #[derive(Deserialize)]
    struct Case {
        pattern: String,
        expanded: Vec<String>,
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
    fn expand(pattern: &str) -> Vec<String> {
        expand_braces(pattern.as_bytes())
            .unwrap()
            .into_iter()
            .map(|result| String::from_utf8(result).unwrap())
            .collect()
    }

    #[test]
    fn keeps_a_pattern_without_groups() {
        // Arrange
        let pattern = "a*b";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["a*b"]);
    }

    #[test]
    fn keeps_an_empty_pattern() {
        // Arrange
        let pattern = "";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec![""]);
    }

    #[test]
    fn expands_a_comma_list() {
        // Arrange
        let pattern = "a{b,c}d";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["abd", "acd"]);
    }

    #[test]
    fn expands_nested_groups() {
        // Arrange
        let pattern = "a{b,c{d,e}}f";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["abf", "acdf", "acef"]);
    }

    #[test]
    fn varies_the_earlier_group_slowest() {
        // Arrange
        let pattern = "{a,b}{c,d}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["ac", "ad", "bc", "bd"]);
    }

    #[test]
    fn keeps_empty_alternatives() {
        // Arrange
        let pattern = "a{,b}c";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["ac", "abc"]);
    }

    #[test]
    fn keeps_escaped_braces_literal_and_escaped() {
        // Arrange
        let pattern = "\\{a,b}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["\\{a,b}"]);
    }

    #[test]
    fn keeps_an_escaped_comma_inside_one_alternative() {
        // Arrange
        let pattern = "{a\\,b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["a\\,b", "c"]);
    }

    #[test]
    fn keeps_a_group_without_a_comma_literal() {
        // Arrange
        let pattern = "{a}{b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["{a}b", "{a}c"]);
    }

    #[test]
    fn keeps_an_unclosed_brace_literal() {
        // Arrange
        let pattern = "x{a{b,c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["x{ab", "x{ac"]);
    }

    #[test]
    fn keeps_a_stray_closing_brace_literal() {
        // Arrange
        let pattern = "{a,b}c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["ac}", "bc}"]);
    }

    #[test]
    fn does_not_split_at_commas_inside_brackets() {
        // Arrange
        let pattern = "{[a,b],c}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["[a,b]", "c"]);
    }

    #[test]
    fn does_not_expand_a_range() {
        // Arrange
        let pattern = "{1..3}";

        // Act
        let result = expand(pattern);

        // Assert
        assert_eq!(result, vec!["{1..3}"]);
    }

    #[test]
    fn rejects_a_pattern_that_is_too_long() {
        // Arrange
        let pattern = vec![b'a'; MAX_PATTERN_LENGTH + 1];

        // Act
        let result = expand_braces(&pattern);

        // Assert
        assert_eq!(result, Err(BraceExpansionError::PatternTooLong));
    }

    #[test]
    fn rejects_braces_nested_too_deeply() {
        // Arrange
        let depth = MAX_NESTING + 1;
        let pattern = ["{a,".repeat(depth), "}".repeat(depth)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::NestedTooDeeply));
    }

    #[test]
    fn expands_braces_nested_as_deeply_as_allowed() {
        // Arrange
        let pattern = ["{a,".repeat(MAX_NESTING), "}".repeat(MAX_NESTING)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes()).map(|results| results.len());

        // Assert
        assert_eq!(result, Ok(MAX_NESTING + 1));
    }

    #[test]
    fn fails_cleanly_on_very_deep_nesting() {
        // Arrange
        let pattern = ["{a,".repeat(2_500), "}".repeat(2_500)].concat();

        // Act
        let result = expand_braces(pattern.as_bytes());

        // Assert
        assert_eq!(result, Err(BraceExpansionError::NestedTooDeeply));
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
                        !rust.reason.trim().is_empty() && rust.expanded != case.expanded
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
        let mismatches: Vec<(&str, &str, Vec<String>)> = table
            .expansions
            .iter()
            .flat_map(|vector| {
                vector.cases.iter().map(move |case| {
                    let wanted = case
                        .rust
                        .as_ref()
                        .map_or(&case.expanded, |rust| &rust.expanded);
                    let actual = expand(&case.pattern);
                    let wrong = actual != *wanted;
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
}
