//! Reading `.gitignore`-style files and deciding about paths as git does.
//!
//! `IgnoreFile` is the only thing the rest of the crate uses. Patterns are
//! matched with the `glob` module, through what that module exposes.

mod bytes_before_nul;
mod decide_path;
mod ignore_file;
mod last_match;
mod parse;
mod parse_line;
mod pattern_matches;
mod relative_path;
mod trim_trailing_spaces;
mod types;

pub use ignore_file::IgnoreFile;

use crate::glob::GlobOptions;

/// The options every ignore-file glob is matched with: `/` separates
/// folders, ASCII case is always ignored, and wildcards match names starting
/// with `.`, as in git.
const GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: true,
    dot: true,
};
