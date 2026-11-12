//! Check `glob_matches` against the glob vectors recorded from git.
//!
//! checksync's TypeScript doesn't use this matcher, so unlike the ignore
//! vectors, these expectations come from git's own glob matcher.

use checksync_core::{GlobOptions, glob_matches};
use serde::Deserialize;

/// The vector table: what it holds, and the vectors themselves.
#[derive(Deserialize)]
struct Table {
    description: String,
    vectors: Vec<Vector>,
}

/// A group of cases exercising one feature of the matcher.
#[derive(Deserialize)]
struct Vector {
    description: String,
    cases: Vec<Case>,
}

/// One pattern and text, the options to match them with, and git's answer.
#[derive(Deserialize)]
struct Case {
    pattern: String,
    text: String,
    pathname: bool,
    casefold: bool,
    matches: bool,
}

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/glob-vectors.json"
));

fn load_table() -> Table {
    let table: Table = serde_json::from_str(VECTORS).expect("valid vector table");
    // Without this, an empty table would pass because there's nothing to
    // mismatch.
    assert!(
        table.vectors.iter().any(|vector| !vector.cases.is_empty()),
        "the vector table has no cases"
    );
    table
}

#[test]
fn says_where_the_expected_results_come_from() {
    // Arrange
    let table = load_table();

    // Act
    let result = table.description.contains("git");

    // Assert
    assert!(result);
}

#[test]
fn matches_every_glob_vector_as_git_does() {
    // Arrange
    let table = load_table();

    // Act
    let mismatches: Vec<String> = table
        .vectors
        .iter()
        .flat_map(|vector| {
            vector.cases.iter().filter_map(|case| {
                let options = GlobOptions {
                    pathname: case.pathname,
                    casefold: case.casefold,
                };
                let actual = glob_matches(case.pattern.as_bytes(), case.text.as_bytes(), options);
                (actual != case.matches).then(|| {
                    format!(
                        "{}: {:?} against {:?} (pathname: {}, casefold: {}): expected {}, got {actual}",
                        vector.description,
                        case.pattern,
                        case.text,
                        case.pathname,
                        case.casefold,
                        case.matches
                    )
                })
            })
        })
        .collect();

    // Assert
    assert_eq!(mismatches, Vec::<String>::new());
}
