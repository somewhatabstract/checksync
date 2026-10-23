//! Check `calc_checksum` against the checksum vectors shared with the
//! TypeScript implementation, so both produce identical checksums.

use checksync_core::calc_checksum;
use serde::Deserialize;

/// One entry in the shared checksum vector table.
#[derive(Deserialize)]
struct Vector {
    description: String,
    lines: Vec<String>,
    checksum: String,
}

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/checksum-vectors.json"
));

#[test]
fn matches_every_shared_checksum_vector() {
    // Arrange
    let vectors: Vec<Vector> = serde_json::from_str(VECTORS).expect("valid vector table");

    // Act
    let mismatches: Vec<String> = vectors
        .iter()
        .filter_map(|vector| {
            let actual = calc_checksum(&vector.lines);
            (actual != vector.checksum).then(|| {
                format!(
                    "{}: expected {}, got {actual}",
                    vector.description, vector.checksum
                )
            })
        })
        .collect();

    // Assert
    assert_eq!(mismatches, Vec::<String>::new());
}
