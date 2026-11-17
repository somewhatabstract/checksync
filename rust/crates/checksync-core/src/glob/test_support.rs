//! Helpers shared by the glob module's unit tests and conformance tests.

use super::braces::{BraceExpansionError, expand_braces};
use super::compiled_glob::{CompiledGlob, GlobOptions};

/// What [`expand`] gives: the expanded patterns as strings, or the error.
pub(super) type Expansion = Result<Vec<String>, BraceExpansionError>;

/// Compiles `pattern` and checks whether `text` matches it.
///
/// # Panics
///
/// Panics if `pattern` can't be compiled.
pub(super) fn matches(pattern: &[u8], text: &[u8], options: GlobOptions) -> bool {
    CompiledGlob::try_new(pattern, options)
        .unwrap()
        .matches(text)
}

/// Expands `pattern` and turns the results into strings for comparing.
pub(super) fn expand(pattern: &str) -> Expansion {
    expand_braces(pattern.as_bytes()).map(|results| {
        results
            .iter()
            .map(|result| String::from_utf8_lossy(result).into_owned())
            .collect()
    })
}
