//! Core checksync logic: checksums, parsing, and sync verification.
//!
//! This crate is pure: it performs no network access and writes nothing to
//! stdout or stderr. Presentation and process concerns belong to the CLI.

mod calc_checksum;
pub mod errors;
mod file_search;
mod get_normalized_path_info;
mod gitignore;
mod glob;
mod js;
mod lines;
mod marker_parser;
mod node_path;
mod relative_path;
mod separators;
mod types;

// TEMPORARY: the gitignore module still imports these two functions by
// their old module paths. Remove both once it imports them from `node_path`
// and `separators`.
mod node_relative {
    pub(crate) use crate::node_path::node_relative;
}

#[cfg(not(unix))]
mod normalize_separators {
    pub(crate) use crate::separators::normalize_separators;
}

pub use calc_checksum::calc_checksum;
pub use file_search::{GetFilesError, get_files, is_allowed_by_ignore_files};
pub use get_normalized_path_info::get_normalized_path_info;
pub use gitignore::IgnoreFile;
pub use js::{is_js_whitespace, js_trim};
pub use lines::{decode_utf8, split_lines};
pub use marker_parser::MarkerParser;
pub use relative_path::{DEFAULT_ROOT_MARKER, closesdir, cwd_relative_path, root_relative_path};
pub use separators::{normalize_separators, os_separators};
pub use types::{
    ErrorCode, ErrorDetails, ErrorLocation, FixAction, IgnoreDecision, Line, LineEnding, Marker,
    Markers, NormalizedPathInfo, ParseEvent, ParsedMarker, RootMarkerError, Target, TargetType,
    Targets,
};
