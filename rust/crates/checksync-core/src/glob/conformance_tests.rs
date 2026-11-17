//! Conformance tests for the glob matcher and brace expansion, against the
//! answers recorded from git's matcher and fast-glob's micromatch.

mod match_vectors {
    use super::super::compiled_glob::tests::matches;
    use super::super::compiled_glob::{CompiledGlob, GlobOptions};
    use super::super::hidden_names::HiddenNames;
    use serde::Deserialize;

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

    /// One pattern and text, its options, and git's answer.
    #[derive(Deserialize)]
    struct Case {
        pattern: String,
        text: String,
        pathname: bool,
        casefold: bool,
        matches: bool,
    }

    /// Glob cases recorded from git's own matcher.
    ///
    /// checksync's TypeScript doesn't use this matcher.
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

    /// One pattern and path, fast-glob's `dot` option, and micromatch's answer.
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

    /// Reads the fast-glob vector table.
    fn load_fast_glob_table() -> FastGlobTable {
        serde_json::from_str(FAST_GLOB_VECTORS).expect("valid fast-glob vector table")
    }

    /// Reads the glob vector table.
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
                        hidden: HiddenNames::MatchAll,
                        unicode: false,
                    };
                    let actual = CompiledGlob::try_new(case.pattern.as_bytes(), options)
                        .is_some_and(|glob| glob.matches(case.text.as_bytes()));
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
                        hidden: if case.dot {
                            HiddenNames::SkipDotSegments
                        } else {
                            HiddenNames::SkipDotNames
                        },
                        unicode: true,
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

mod expansion_vectors {
    use super::super::braces::tests::{Expansion, expand};
    use serde::Deserialize;

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

    /// Reads the fast-glob vector table.
    fn load_table() -> Table {
        serde_json::from_str(VECTORS).expect("valid fast-glob vector table")
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
