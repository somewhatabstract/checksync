//! A matcher for git-style glob patterns, plus fast-glob's brace expansion.
//!
//! Patterns are compiled once with [`compile_glob`] and then matched against any
//! number of texts with [`compiled_glob_matches`]. Matching works on bytes, as
//! git's does, or on whole characters, as fast-glob's does, with the options in
//! [`GlobOptions`]. [`expand_braces`] expands `{a,b}` groups first, as fast-glob
//! does. The module depends on nothing else in the crate, so it could become a
//! crate of its own.
//!
//! [`compile_glob`]: fn@compile_glob
//! [`compiled_glob_matches`]: fn@compiled_glob_matches
//! [`expand_braces`]: fn@expand_braces

mod advance;
mod advance_wildcards;
mod braces;
mod bracket_item;
mod bracket_set;
mod compiled_glob;
#[cfg(test)]
mod conformance_tests;
mod hidden_names;
mod posix_class;
mod tokenize;
mod unit_matcher;
mod units;

pub(crate) use braces::{BraceExpansionError, expand_braces};
pub(crate) use compiled_glob::{CompiledGlob, GlobOptions, compile_glob, compiled_glob_matches};
pub(crate) use hidden_names::HiddenNames;

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
