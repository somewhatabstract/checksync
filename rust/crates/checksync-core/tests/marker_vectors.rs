//! Check `MarkerParser` against the marker-parser vectors shared with the
//! TypeScript implementation, so both parse tags identically.

use checksync_core::{
    ErrorDetails, FixAction, MarkerParser, NormalizedPathInfo, ParseEvent, TargetType,
};
use serde::Deserialize;
use serde_json::{Map, Value, json};

/// One entry in the shared marker-parser vector table.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    description: String,
    comments: Vec<String>,
    missing_targets: Vec<String>,
    lines: Vec<String>,
    events: Vec<Value>,
}

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/marker-vectors.json"
));

fn load_vectors() -> Vec<Vector> {
    let vectors: Vec<Vector> = serde_json::from_str(VECTORS).expect("valid vector table");
    // Without this, an empty table would pass because there's nothing to
    // mismatch.
    assert!(!vectors.is_empty(), "the vector table has no vectors");
    vectors
}

/// Write an error the way the TypeScript `ErrorDetails` serializes, leaving
/// out fields that are `undefined` there.
fn error_to_json(error: &ErrorDetails) -> Value {
    let mut object = Map::new();
    object.insert("markerID".into(), json!(error.marker_id));
    object.insert("reason".into(), json!(error.reason));
    object.insert("code".into(), json!(error.code.as_str()));
    if let Some(location) = &error.location {
        let mut loc = Map::new();
        loc.insert("line".into(), json!(location.line));
        if let Some(column) = location.start_column {
            loc.insert("startColumn".into(), json!(column));
        }
        if let Some(column) = location.end_column {
            loc.insert("endColumn".into(), json!(column));
        }
        object.insert("location".into(), Value::Object(loc));
    }
    if let Some(fix) = &error.fix {
        let fix = match fix {
            FixAction::Delete {
                line,
                description,
                declaration,
            } => json!({
                "type": "delete",
                "line": line,
                "description": description,
                "declaration": declaration,
            }),
            FixAction::Replace {
                line,
                text,
                description,
                declaration,
            } => json!({
                "type": "replace",
                "line": line,
                "text": text,
                "description": description,
                "declaration": declaration,
            }),
        };
        object.insert("fix".into(), fix);
    }
    Value::Object(object)
}

/// Write an event in the vector table's format.
fn event_to_json(event: &ParseEvent) -> Value {
    match event {
        ParseEvent::Error(error) => json!({ "error": error_to_json(error) }),
        ParseEvent::Marker(marker) => {
            let targets: Map<String, Value> = marker
                .targets
                .iter()
                .map(|(line, target)| {
                    let kind = match target.kind {
                        TargetType::Local => "local",
                        TargetType::Remote => "remote",
                    };
                    (
                        line.to_string(),
                        json!({
                            "target": target.target,
                            "type": kind,
                            "checksum": target.checksum,
                            "declaration": target.declaration,
                        }),
                    )
                })
                .collect();
            json!({
                "marker": {
                    "id": marker.id,
                    "content": marker.content,
                    "targets": targets,
                    "commentStart": marker.comment_start,
                    "commentEnd": marker.comment_end,
                }
            })
        }
    }
}

/// Parse a vector's lines and return what the parser reported.
fn parse(vector: &Vector) -> Vec<Value> {
    let mut parser = MarkerParser::new(&vector.comments, |target: &str| {
        let remote = target.contains("://");
        NormalizedPathInfo {
            path: target.to_owned(),
            exists: remote || !vector.missing_targets.iter().any(|m| m == target),
            kind: if remote {
                TargetType::Remote
            } else {
                TargetType::Local
            },
        }
    });
    for line in &vector.lines {
        parser.parse_line(line);
    }
    parser.finish().iter().map(event_to_json).collect()
}

#[test]
fn parses_every_shared_marker_vector() {
    // Arrange
    let vectors = load_vectors();

    // Act
    let mismatches: Vec<String> = vectors
        .iter()
        .filter_map(|vector| {
            let actual = parse(vector);
            (actual != vector.events).then(|| {
                format!(
                    "{}:\n  expected {}\n  got      {}",
                    vector.description,
                    Value::Array(vector.events.clone()),
                    Value::Array(actual)
                )
            })
        })
        .collect();

    // Assert
    assert!(mismatches.is_empty(), "{}", mismatches.join("\n"));
}
