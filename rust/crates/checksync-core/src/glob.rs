//! A matcher for git-style glob patterns.
//!
//! Patterns are compiled once with `compile_glob` and then matched against
//! any number of texts with `compiled_glob_matches`. Matching works on
//! bytes, as git's does, with the options in `GlobOptions`. `expand_braces`
//! expands `{a,b}` groups first, as fast-glob does. The module depends on
//! nothing else in the crate, so it could become a crate of its own.

mod advance_any_folders;
mod advance_glob_positions;
mod advance_one_byte;
mod advance_star;
mod brace_bracket_end;
mod brace_results_fit;
mod bracket_item_matches;
mod bracket_set_contains;
mod byte_matcher_matches;
mod byte_matcher_matches_hidden_dot;
mod bytes_before_nul;
mod combine_brace_texts;
mod compile_glob;
mod compiled_glob_matches;
mod contains_brace_group;
mod expand_brace_pieces;
mod expand_braces;
mod find_brace_group;
mod next_brace_piece;
mod parse_bracket_set;
mod posix_class_contains;
mod posix_class_from_name;
mod read_bracket_class;
mod read_bracket_item;
mod read_glob_byte;
mod read_star_run;
mod release_brace_budget;
mod start_brace_sequence;
mod starts_hidden_name;
mod step_brace_frame;
mod take_brace_budget;
mod tokenize_glob;
mod types;

pub(crate) use compile_glob::compile_glob;
pub(crate) use compiled_glob_matches::compiled_glob_matches;
pub(crate) use types::{CompiledGlob, GlobOptions};

/// The options for tests whose results don't depend on them.
///
/// There's no pathname mode or case folding, and hidden names are matched.
#[cfg(test)]
const TEST_OPTIONS: GlobOptions = GlobOptions {
    pathname: false,
    casefold: false,
    dot: true,
};

/// The options for tests in pathname mode.
///
/// There's no case folding, and hidden names are matched.
#[cfg(test)]
const TEST_PATHNAME_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    dot: true,
};
