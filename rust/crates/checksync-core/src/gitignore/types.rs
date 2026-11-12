//! Types used by the gitignore handling.

use crate::glob::CompiledGlob;

/// One pattern read from a `.gitignore`-style file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GitignorePattern {
    /// The compiled glob to match.
    ///
    /// It's compiled from the pattern without any leading `!`, leading `/`
    /// or trailing `/`.
    pub(super) glob: CompiledGlob,
    /// Whether the pattern started with `!`, so a match unignores.
    pub(super) negated: bool,
    /// Whether the pattern ended with `/`, so it matches only folders.
    pub(super) folders_only: bool,
    /// Whether the pattern is anchored to the ignore file's folder.
    ///
    /// It is when it held a `/` before any trailing one, and it then matches
    /// the whole path from the folder rather than just the last name in it.
    pub(super) anchored: bool,
}
