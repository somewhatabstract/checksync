//! Reading `.gitignore`-style files and deciding about paths as git does.
//!
//! `IgnoreFile` is the only thing the rest of the crate uses. Patterns are
//! matched with the `glob` module, through what that module exposes.

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
