//! A matcher for git-style glob patterns.
//!
//! Patterns are compiled once with `compile_glob` and then matched against
//! any number of texts with `compiled_glob_matches`. Matching works on
//! bytes, as git's does, or on whole characters, as fast-glob's does, with
//! the options in `GlobOptions`. `expand_braces`
//! expands `{a,b}` groups first, as fast-glob does. The module depends on
//! nothing else in the crate, so it could become a crate of its own.

mod advance_any_folders;
mod advance_glob_positions;
mod advance_one_byte;
mod advance_one_char;
mod advance_star;
mod brace_bracket_end;
mod brace_results_fit;
mod bracket_item_matches;
mod bracket_set_contains;
mod bytes_before_nul;
mod combine_brace_texts;
mod compile_glob;
mod compiled_glob_matches;
mod contains_brace_group;
mod decode_glob_char;
mod expand_brace_pieces;
mod expand_braces;
mod find_brace_group;
mod in_dot_segment;
mod next_brace_piece;
mod parse_bracket_set;
mod posix_class_contains;
mod posix_class_from_name;
mod read_bracket_class;
mod read_bracket_item;
mod read_glob_char;
mod read_star_run;
mod release_brace_budget;
mod start_brace_sequence;
mod starts_hidden_name;
mod step_brace_frame;
mod take_brace_budget;
mod tokenize_glob;
mod types;
mod unit_matcher_matches;
mod unit_matcher_matches_hidden_dot;

pub(crate) use compile_glob::compile_glob;
pub(crate) use compiled_glob_matches::compiled_glob_matches;
pub(crate) use expand_braces::expand_braces;
pub(crate) use types::BraceExpansionError;
pub(crate) use types::{CompiledGlob, GlobOptions, HiddenNames};

/// The options for tests whose results don't depend on them.
///
/// There's no pathname mode or case folding, and hidden names are matched.
#[cfg(test)]
const TEST_OPTIONS: GlobOptions = GlobOptions {
    pathname: false,
    casefold: false,
    hidden: HiddenNames::MatchAll,
    unicode: false,
};

/// The options for tests in pathname mode.
///
/// There's no case folding, and hidden names are matched.
#[cfg(test)]
const TEST_PATHNAME_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    hidden: HiddenNames::MatchAll,
    unicode: false,
};

/// The options for tests in pathname mode with whole characters.
///
/// There's no case folding, and hidden names are matched.
#[cfg(test)]
const TEST_UNICODE_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    hidden: HiddenNames::MatchAll,
    unicode: true,
};
