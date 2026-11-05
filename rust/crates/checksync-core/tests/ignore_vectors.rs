//! Check `IgnoreFile` against the ignore-file vectors shared with the
//! TypeScript implementation, so both apply ignore files identically.

use std::fs;

use checksync_core::{IgnoreDecision, IgnoreFile};
use serde::Deserialize;

/// One path in a vector, and what the ignore file should decide about it.
#[derive(Deserialize)]
struct ExpectedPath {
    path: String,
    result: String,
}

/// One entry in the shared ignore-file vector table.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    description: String,
    folder: Option<String>,
    ignore_file: String,
    paths: Vec<ExpectedPath>,
}

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/ignore-vectors.json"
));

fn load_vectors() -> Vec<Vector> {
    let vectors: Vec<Vector> = serde_json::from_str(VECTORS).expect("valid vector table");
    // Without this, an empty table would pass because there's nothing to
    // mismatch.
    assert!(!vectors.is_empty(), "the vector table has no vectors");
    vectors
}

/// Write a decision in the vector table's terms.
fn decision_name(decision: IgnoreDecision) -> &'static str {
    match decision {
        IgnoreDecision::Ignored => "ignored",
        IgnoreDecision::Unignored => "unignored",
        IgnoreDecision::NoOpinion => "none",
    }
}

#[test]
fn decides_every_shared_ignore_vector() {
    // Arrange
    let vectors = load_vectors();

    // Act
    let mismatches: Vec<String> = vectors
        .iter()
        .flat_map(|vector| {
            let dir = tempfile::TempDir::new().unwrap();
            let folder = dir.path().join(vector.folder.as_deref().unwrap_or(""));
            fs::create_dir_all(&folder).unwrap();
            let path = folder.join(".gitignore");
            fs::write(&path, &vector.ignore_file).unwrap();
            let ignore_file = IgnoreFile::load(&path).unwrap();
            vector
                .paths
                .iter()
                .filter_map(|expected| {
                    let actual = decision_name(ignore_file.decide(&folder.join(&expected.path)));
                    (actual != expected.result).then(|| {
                        format!(
                            "{}: {}: expected {}, got {actual}",
                            vector.description, expected.path, expected.result
                        )
                    })
                })
                .collect::<Vec<_>>()
        })
        .collect();

    // Assert
    assert_eq!(mismatches, Vec::<String>::new());
}
