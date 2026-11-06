//! Check `get_normalized_path_info` against the target-resolution vectors
//! shared with the TypeScript implementation.

use std::fs;
use std::path::{MAIN_SEPARATOR_STR, Path};

use checksync_core::{TargetType, get_normalized_path_info};
use serde::Deserialize;

/// What a vector expects the target to resolve to.
#[derive(Deserialize)]
struct Expected {
    path: String,
    exists: bool,
    #[serde(rename = "type")]
    kind: String,
}

/// One entry in the shared vector table.
#[derive(Deserialize)]
struct Vector {
    description: String,
    target: String,
    expected: Expected,
}

/// The shared table: the files and folders to create, and the vectors.
#[derive(Deserialize)]
struct Table {
    files: Vec<String>,
    folders: Vec<String>,
    vectors: Vec<Vector>,
}

const TABLE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/normalized-path-vectors.json"
));

/// Swap the table's placeholders for the real folders.
fn expand(value: &str, root: &Path, parent: &Path) -> String {
    value
        .replace("<root>", &root.display().to_string())
        .replace("<parent>", &parent.display().to_string())
}

#[test]
fn resolves_every_shared_target_vector() {
    // Arrange
    let table: Table = serde_json::from_str(TABLE).expect("valid vector table");
    assert!(!table.vectors.is_empty(), "the vector table has no vectors");
    let parent = tempfile::TempDir::new().unwrap();
    let root = parent.path().join("root");
    for folder in &table.folders {
        fs::create_dir_all(root.join(folder)).unwrap();
    }
    for file in &table.files {
        let file = root.join(file);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, "").unwrap();
    }

    // Act
    let mismatches: Vec<String> = table
        .vectors
        .iter()
        .filter_map(|vector| {
            let result =
                get_normalized_path_info(&root, &expand(&vector.target, &root, parent.path()));
            let kind = match result.kind {
                TargetType::Local => "local",
                TargetType::Remote => "remote",
            };
            let expected_path = if vector.expected.kind == "local" {
                expand(&vector.expected.path, &root, parent.path()).replace('/', MAIN_SEPARATOR_STR)
            } else {
                vector.expected.path.clone()
            };
            let actual = (result.path, result.exists, kind);
            let wanted = (
                expected_path,
                vector.expected.exists,
                vector.expected.kind.as_str(),
            );
            (actual != wanted).then(|| {
                format!(
                    "{}: expected {wanted:?}, got {actual:?}",
                    vector.description
                )
            })
        })
        .collect();

    // Assert
    assert_eq!(mismatches, Vec::<String>::new());
}
