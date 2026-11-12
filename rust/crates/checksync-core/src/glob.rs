//! A matcher for git-style glob patterns.
//!
//! Patterns are compiled once with `compile_glob` and then matched against
//! any number of texts with `compiled_glob_matches`. Matching works on
//! bytes, as git's does, with the options in `GlobOptions`. The module
//! depends on nothing else in the crate, so it could become a crate of its
//! own.

mod advance_any_folders;
mod advance_glob_positions;
mod advance_one_byte;
mod advance_star;
mod bracket_item_matches;
mod bracket_set_contains;
mod byte_matcher_matches;
mod bytes_before_nul;
mod compile_glob;
mod compiled_glob_matches;
mod parse_bracket_set;
mod posix_class_contains;
mod posix_class_from_name;
mod read_bracket_class;
mod read_bracket_item;
mod read_glob_byte;
mod read_star_run;
mod tokenize_glob;
mod types;

pub(crate) use compile_glob::compile_glob;
pub(crate) use compiled_glob_matches::compiled_glob_matches;
pub(crate) use types::{CompiledGlob, GlobOptions};
