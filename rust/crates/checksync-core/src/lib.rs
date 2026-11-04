//! Core checksync logic: checksums, parsing, and sync verification.
//!
//! This crate is pure: it performs no network access and writes nothing to
//! stdout or stderr. Presentation and process concerns belong to the CLI.

mod calc_checksum;
mod decode_utf8;
pub mod errors;
mod is_js_whitespace;
mod js_trim;
mod split_lines;
mod types;

pub use calc_checksum::calc_checksum;
pub use decode_utf8::decode_utf8;
pub use is_js_whitespace::is_js_whitespace;
pub use js_trim::js_trim;
pub use split_lines::split_lines;
pub use types::{
    ErrorCode, ErrorDetails, ErrorLocation, FixAction, Line, LineEnding, Marker, Markers,
    NormalizedPathInfo, Target, TargetType, Targets,
};
