//! A matcher for git-style glob patterns, plus fast-glob's brace expansion.
//!
//! Patterns are compiled once with [`CompiledGlob::try_new`] and then matched
//! against any number of texts with [`CompiledGlob::matches`]. Matching works on
//! bytes, as git's does, or on whole characters, as fast-glob's does, with the
//! options in [`GlobOptions`]. [`expand_braces`] expands `{a,b}` groups first, as
//! fast-glob does. The module depends on nothing else in the crate, so it could become a
//! crate of its own.
//!
//! [`expand_braces`]: fn@expand_braces

mod braces;
mod bracket_item;
mod bracket_set;
mod compiled_glob;
#[cfg(test)]
mod conformance_tests;
mod hidden_names;
mod posix_class;
mod token;
mod unit_matcher;
mod units;

pub(crate) use braces::{BraceExpansionError, expand_braces};
pub(crate) use compiled_glob::{CompiledGlob, GlobOptions};
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
