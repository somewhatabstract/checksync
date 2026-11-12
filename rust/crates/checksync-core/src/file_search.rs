//! Finding the files checksync checks, from include, exclude and ignore files.
//!
//! This follows checksync's JavaScript implementation, which finds files with
//! fast-glob: include patterns are planned into folders to walk, the folders
//! are walked without following links, and files are filtered by exclude
//! patterns and `.gitignore`-style files. Matching uses the crate's `glob`
//! module, and ignore files use its `gitignore` module.

mod compile_folder_exclude;
mod expand_folder_pattern;
mod expand_pattern_braces;
mod find_files;
mod get_files;
mod glob_base;
mod glob_text;
mod is_base_excluded;
mod is_excluded;
mod join_glob_text;
mod load_ignore_files;
mod pattern_name_limit;
mod pattern_names_hidden;
mod plan_glob_tasks;
mod should_walk_folder;
mod sort_paths_like_javascript;
mod strip_leading_dot_slash;
mod types;
mod walk_glob_task;

use crate::glob::GlobOptions;

pub use get_files::get_files;
pub use types::GetFilesError;

/// How include patterns match paths: by folder, case-sensitively, by whole
/// characters, and without wildcards matching names that start with `.`, as
/// fast-glob does by default.
const INCLUDE_GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    dot: false,
    unicode: true,
};

/// How exclude patterns match paths: as include patterns do, except that
/// wildcards match names that start with `.` too, as fast-glob's do.
const EXCLUDE_GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    dot: true,
    unicode: true,
};
