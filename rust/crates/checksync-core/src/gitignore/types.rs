//! Types used by the gitignore handling.

use crate::glob::CompiledGlob;

/// One pattern read from a `.gitignore`-style file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GitignorePattern {
    /// The compiled glob to match, from the pattern without any leading
    /// `!`, leading `/` or trailing `/`.
    pub(super) glob: CompiledGlob,
    /// Whether the pattern started with `!`, so a match unignores.
    pub(super) negated: bool,
    /// Whether the pattern ended with `/`, so it matches only folders.
    pub(super) folders_only: bool,
    /// Whether the pattern held a `/` before any trailing one, so it
    /// matches the whole path from the ignore file's folder rather than
    /// just the last name in it.
    pub(super) anchored: bool,
}
