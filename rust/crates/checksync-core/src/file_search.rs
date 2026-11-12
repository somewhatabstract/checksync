//! Finding the files checksync checks, from include, exclude and ignore files.
//!
//! This follows checksync's JavaScript implementation, which finds files with
//! fast-glob: include patterns are planned into folders to walk, the folders
//! are walked without following links, and files are filtered by exclude
//! patterns and `.gitignore`-style files. Matching uses the crate's `glob`
//! module, and ignore files use its `gitignore` module.

mod collapse_slashes;
mod compile_pattern_set;
mod expand_folder_pattern;
mod expand_pattern_braces;
mod find_files;
mod folder_exclude_forms;
mod get_files;
mod glob_base;
mod glob_text;
mod is_base_excluded;
mod join_glob_text;
mod load_found_ignore_files;
mod load_ignore_files;
mod matches_pattern_set;
mod pattern_name_limit;
mod pattern_names_hidden;
mod plan_glob_tasks;
mod relative_exclude_pattern;
mod should_walk_folder;
mod sort_paths_like_javascript;
mod strip_leading_dot_slash;
mod types;
mod walk_glob_folder;

use crate::glob::{GlobOptions, HiddenNames};

pub use get_files::get_files;
pub use types::GetFilesError;

/// How include patterns match paths: by folder, case-sensitively, by whole
/// characters, and without wildcards matching names that start with `.`, or
/// running over `.` or `..`, as fast-glob does by default.
const INCLUDE_GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    hidden: HiddenNames::SkipDotNames,
    unicode: true,
};

/// How exclude patterns match paths: as include patterns do, except that
/// wildcards match names that start with `.` too, as fast-glob's do. They
/// still don't run over `.` or `..`.
const EXCLUDE_GLOB_OPTIONS: GlobOptions = GlobOptions {
    pathname: true,
    casefold: false,
    hidden: HiddenNames::SkipDotSegments,
    unicode: true,
};
