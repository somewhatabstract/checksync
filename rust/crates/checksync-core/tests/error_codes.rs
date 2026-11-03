//! Check that the Rust error codes match checksync's JavaScript ones.

use checksync_core::ErrorCode;

/// The JavaScript `ErrorCode` enum, which the published output uses.
const JS_ERROR_CODES: &str = include_str!("../../../../src/error-codes.ts");

/// Pull the string value out of each `name = "value",` line of the enum.
fn js_codes() -> Vec<&'static str> {
    JS_ERROR_CODES
        .lines()
        .filter_map(|line| line.split_once("= \""))
        .filter_map(|(_, rest)| rest.split_once('"'))
        .map(|(code, _)| code)
        .collect()
}

#[test]
fn error_codes_match_javascript() {
    let rust: Vec<&str> = ErrorCode::ALL.iter().map(|code| code.as_str()).collect();

    let js = js_codes();

    assert!(!js.is_empty(), "found no codes in error-codes.ts");
    assert_eq!(rust, js);
}
