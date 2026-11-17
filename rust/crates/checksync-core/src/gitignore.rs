//! Reads `.gitignore`-style files and decides about paths as git does.
//!
//! [`IgnoreFile`] is the only thing the rest of the crate uses. Patterns are
//! matched with the [`glob`] module, through what that module exposes.
//!
//! [`glob`]: crate::glob

mod decide;
mod ignore_file;
mod pattern;

pub use ignore_file::IgnoreFile;
