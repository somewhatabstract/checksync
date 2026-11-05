//! Core checksync logic: checksums, parsing, and sync verification.
//!
//! This crate is pure: it performs no network access and writes nothing to
//! stdout or stderr. Presentation and process concerns belong to the CLI.

mod calc_checksum;
mod closesdir;
mod cwd_relative_path;
mod decode_utf8;
pub mod errors;
mod get_normalized_path_info;
mod gitignore_pattern_matches;
mod ignore_file;
mod is_allowed_by_ignore_files;
mod is_js_whitespace;
mod js_object_keys;
mod js_trim;
mod marker_parser;
mod match_bracket_class;
mod matches_posix_class;
mod node_normalize;
mod node_relative;
mod normalize_separators;
mod os_separators;
mod parse_gitignore_pattern;
mod read_gitignore_patterns;
mod root_relative_path;
mod split_lines;
mod trim_gitignore_trailing_spaces;
mod types;
mod wildmatch;

pub use calc_checksum::calc_checksum;
pub use closesdir::{DEFAULT_ROOT_MARKER, closesdir};
pub use cwd_relative_path::cwd_relative_path;
pub use decode_utf8::decode_utf8;
pub use get_normalized_path_info::get_normalized_path_info;
pub use ignore_file::IgnoreFile;
pub use is_allowed_by_ignore_files::is_allowed_by_ignore_files;
pub use is_js_whitespace::is_js_whitespace;
pub use js_trim::js_trim;
pub use marker_parser::MarkerParser;
pub use normalize_separators::normalize_separators;
pub use os_separators::os_separators;
pub use root_relative_path::root_relative_path;
pub use split_lines::split_lines;
pub use types::{
    ErrorCode, ErrorDetails, ErrorLocation, FixAction, IgnoreDecision, Line, LineEnding, Marker,
    Markers, NormalizedPathInfo, ParseEvent, ParsedMarker, RootMarkerError, Target, TargetType,
    Targets,
};
