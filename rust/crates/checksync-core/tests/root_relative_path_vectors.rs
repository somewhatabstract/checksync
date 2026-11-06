//! Check `root_relative_path` against the root-relative path vectors shared
//! with the TypeScript implementation.

use std::fs;
use std::path::{MAIN_SEPARATOR_STR, Path};

use checksync_core::root_relative_path;
use serde::Deserialize;

/// What a vector expects: a relative path, or an error message.
#[derive(Deserialize, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Expected {
    Path(String),
    Error(String),
}

/// One entry in the shared vector table.
#[derive(Deserialize)]
struct Vector {
    description: String,
    file: String,
    marker: String,
    expected: Expected,
}

/// The shared table: the marker files to create, and the vectors.
#[derive(Deserialize)]
struct Table {
    markers: Vec<String>,
    vectors: Vec<Vector>,
}

const TABLE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/root-relative-path-vectors.json"
));

#[test]
fn gives_every_shared_root_relative_vector() {
    // Arrange
    let table: Table = serde_json::from_str(TABLE).expect("valid vector table");
    assert!(!table.vectors.is_empty(), "the vector table has no vectors");
    let parent = tempfile::TempDir::new().unwrap();
    let root = parent.path().join("root");
    for marker in &table.markers {
        let marker = root.join(marker);
        fs::create_dir_all(marker.parent().unwrap()).unwrap();
        fs::write(marker, "").unwrap();
    }
    let root_text = root.display().to_string();

    // Act
    let mismatches: Vec<String> = table
        .vectors
        .iter()
        .filter_map(|vector| {
            let file = vector.file.replace("<root>", &root_text);
            let actual = match root_relative_path(Path::new(&file), Some(&vector.marker)) {
                Ok(path) => Expected::Path(path.display().to_string()),
                Err(error) => Expected::Error(error.to_string()),
            };
            let wanted = match &vector.expected {
                Expected::Path(path) => Expected::Path(path.replace('/', MAIN_SEPARATOR_STR)),
                Expected::Error(message) => Expected::Error(message.replace("<root>", &root_text)),
            };
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
