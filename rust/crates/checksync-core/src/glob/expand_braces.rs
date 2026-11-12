use super::read_brace_piece::read_brace_piece;

/// Expand the `{a,b}` brace groups in a pattern into separate patterns.
///
/// This follows the brace expansion fast-glob applies through micromatch.
/// Each group stands for each of its comma-separated alternatives in turn,
/// and groups can nest. With several groups, the earlier group varies
/// slowest. A `{` that doesn't start a group, such as in `{a}` or an
/// unclosed `{`, and a stray `}` stay literal. A `\` escapes the byte after
/// it, and braces and commas inside `[...]` don't count. Everything but the
/// groups is kept exactly as written, escapes included, so each result is
/// still a glob pattern.
///
/// Unlike micromatch, ranges such as `{1..3}` or `{a..c}` aren't expanded:
/// with no comma, they stay literal.
///
/// # Arguments
///
/// * `pattern` - The pattern to expand.
///
/// # Returns
///
/// The expanded patterns, in order, including any duplicates. A pattern
/// with no groups gives just itself.
#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "the file finder will call this, through a re-export added then"
    )
)]
#[must_use]
pub(crate) fn expand_braces(pattern: &[u8]) -> Vec<Vec<u8>> {
    let mut results = vec![Vec::new()];
    let mut index = 0;
    while index < pattern.len() {
        let (texts, next) = read_brace_piece(pattern, index);
        results = results
            .iter()
            .flat_map(|prefix| {
                texts
                    .iter()
                    .map(move |text| [prefix.as_slice(), text].concat())
            })
            .collect();
        index = next;
    }
    results
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::expand_braces;

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
