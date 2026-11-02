//! Check `decode_utf8` and `split_lines` against the line vectors shared with
//! the TypeScript implementation, so both read files into identical lines.

use checksync_core::{decode_utf8, split_lines};
use serde::Deserialize;

/// One piece of a vector's bytes: UTF-8 text (optionally repeated) or raw
/// bytes in hex, for input that isn't valid UTF-8.
#[derive(Deserialize)]
#[serde(untagged)]
enum Part {
    Text { text: String, repeat: Option<usize> },
    Hex { hex: String },
}

/// Bytes or text written as a plain string or as a list of parts.
#[derive(Deserialize)]
#[serde(untagged)]
enum Parts {
    Plain(String),
    List(Vec<Part>),
}

/// One expected line of a vector.
#[derive(Deserialize)]
struct ExpectedLine {
    text: Parts,
    ending: String,
}

/// One entry in the shared line vector table.
#[derive(Deserialize)]
struct Vector {
    description: String,
    input: Parts,
    lines: Vec<ExpectedLine>,
}

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/line-vectors.json"
));

/// Join parts into the bytes they describe.
fn to_bytes(parts: &Parts) -> Vec<u8> {
    match parts {
        Parts::Plain(text) => text.as_bytes().to_vec(),
        Parts::List(list) => list
            .iter()
            .flat_map(|part| match part {
                Part::Text { text, repeat } => text.repeat(repeat.unwrap_or(1)).into_bytes(),
                Part::Hex { hex } => (0..hex.len())
                    .step_by(2)
                    .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("valid hex"))
                    .collect(),
            })
            .collect(),
    }
}

fn load_vectors() -> Vec<Vector> {
    let vectors: Vec<Vector> = serde_json::from_str(VECTORS).expect("valid vector table");
    // Without this, an empty table would pass because there's nothing to
    // mismatch.
    assert!(!vectors.is_empty(), "the vector table has no vectors");
    vectors
}

#[test]
fn reads_every_shared_line_vector() {
    // Arrange
    let vectors = load_vectors();

    // Act
    let mismatches: Vec<String> = vectors
        .iter()
        .filter_map(|vector| {
            let actual: Vec<(String, &str)> = split_lines(&decode_utf8(&to_bytes(&vector.input)))
                .into_iter()
                .map(|line| (line.text, line.ending.as_str()))
                .collect();
            let expected: Vec<(String, &str)> = vector
                .lines
                .iter()
                .map(|line| {
                    let text = String::from_utf8(to_bytes(&line.text)).expect("UTF-8 line text");
                    (text, line.ending.as_str())
                })
                .collect();
            (actual != expected).then(|| {
                format!(
                    "{}: expected {expected:?}, got {actual:?}",
                    vector.description
                )
            })
        })
        .collect();

    // Assert
    assert_eq!(mismatches, Vec::<String>::new());
}
