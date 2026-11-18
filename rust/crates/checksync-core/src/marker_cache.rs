//! The markers of every file a run checks, and of the files they target.
#![cfg_attr(
    not(test),
    expect(dead_code, reason = "checking a run uses the cache in a later change")
)]

mod build;
mod file_errors;
#[cfg(all(test, unix))]
mod link_tests;
mod real_path;

use std::collections::{HashMap, HashSet};
use std::io;
use std::path::{Path, PathBuf};

use indexmap::IndexMap;
use rayon::prelude::*;

use crate::errors::ErrorDetails;
use crate::options::Options;
use crate::parse_file::ParsedFile;
use crate::types::{Markers, RootMarkerError};

use self::real_path::real_path;

/// One file's entry in the cache.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct FileInfo<'a> {
    /// Whether the file's errors are never fixed.
    ///
    /// The files a run is asked to check aren't read-only, but the files they
    /// target are, and so is every path that reaches a file through a link.
    pub read_only: bool,
    /// The paths that reach the same file: its real path, then each link to
    /// it in the order they were found. A path can appear more than once.
    pub aliases: &'a [PathBuf],
    /// The file's markers, by id.
    pub markers: &'a Markers,
    /// The problems found reading the file.
    pub errors: &'a [ErrorDetails],
    /// How many lines the file has, or `None` if it couldn't be read.
    pub line_count: Option<usize>,
}

/// What a file's path and the links to it share.
#[derive(Debug, Clone, PartialEq, Eq)]
struct FileContents {
    aliases: Vec<PathBuf>,
    markers: Markers,
    errors: Vec<ErrorDetails>,
    line_count: Option<usize>,
}

/// A path's place in the cache: whether it's read-only, and which contents it reaches.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Entry {
    read_only: bool,
    contents: usize,
}

/// The markers of every file a run checks, and of the files they target.
///
/// Built as checksync's JavaScript `getMarkersFromFiles` builds its cache,
/// with entries in the same order: each file in turn, by its real path and
/// then by the path it was given if that went through a link.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct MarkerCache {
    entries: IndexMap<PathBuf, Entry>,
    contents: Vec<FileContents>,
}

impl MarkerCache {
    /// Builds the cache from the files to check.
    ///
    /// The files are read first, and can be fixed. Then the local files their
    /// tags target are read too, as read-only, in the order the tags were
    /// found. A file is read once however many paths reach it, and files are
    /// read in parallel, but the result is the same as reading them in turn.
    ///
    /// A path that can't be resolved, or whose root can't be found, gets a
    /// [`could_not_parse`](ErrorDetails::could_not_parse) error naming it.
    /// Its message is the operating system's, where the JavaScript shows
    /// Node.js's.
    #[must_use]
    pub(crate) fn from_files(options: &Options, files: &[PathBuf]) -> Self {
        let mut cache = Self::default();
        let referenced = cache.cache_files(options, files, false);
        let referenced: Vec<PathBuf> = referenced.into_iter().map(PathBuf::from).collect();
        cache.cache_files(options, &referenced, true);
        cache
    }

    /// Returns the cache entry for a path, if it has one.
    #[must_use]
    pub(crate) fn get(&self, path: &Path) -> Option<FileInfo<'_>> {
        self.entries.get(path).map(|entry| self.info(*entry))
    }

    /// Returns every path in the cache with its entry, in the order they were added.
    pub(crate) fn iter(&self) -> impl Iterator<Item = (&Path, FileInfo<'_>)> {
        self.entries
            .iter()
            .map(|(path, entry)| (path.as_path(), self.info(*entry)))
    }

    fn info(&self, entry: Entry) -> FileInfo<'_> {
        let contents = &self.contents[entry.contents];
        FileInfo {
            read_only: entry.read_only,
            aliases: &contents.aliases,
            markers: &contents.markers,
            errors: &contents.errors,
            line_count: contents.line_count,
        }
    }

    /// Adds files to the cache, and returns the local targets their tags name.
    fn cache_files(
        &mut self,
        options: &Options,
        files: &[PathBuf],
        read_only: bool,
    ) -> Vec<String> {
        let real_paths: Vec<io::Result<PathBuf>> =
            files.par_iter().map(|file| real_path(file)).collect();
        // Each real path not yet in the cache is read once, however many of
        // the files reach it.
        let mut seen = HashSet::new();
        let to_parse: Vec<&PathBuf> = real_paths
            .iter()
            .flatten()
            .filter(|real| !self.entries.contains_key(*real) && seen.insert(*real))
            .collect();
        let mut parsed: HashMap<&PathBuf, Result<ParsedFile, RootMarkerError>> = to_parse
            .into_par_iter()
            .map(|real| (real, ParsedFile::parse(options, real, read_only)))
            .collect();

        let mut referenced = Vec::new();
        for (file, real) in files.iter().zip(&real_paths) {
            let real = match real {
                Ok(real) => real,
                Err(error) => {
                    self.add_unreadable(file, file, read_only, &error.to_string());
                    continue;
                }
            };
            if let Some(result) = parsed.remove(real) {
                match result {
                    Ok(file_result) => {
                        referenced.extend(file_result.referenced_files);
                        let contents = self.push_contents(FileContents {
                            aliases: Vec::new(),
                            markers: file_result.markers,
                            errors: file_result.errors,
                            line_count: file_result.line_count,
                        });
                        self.set(real, read_only, contents);
                    }
                    Err(error) => self.add_unreadable(real, file, read_only, &error.to_string()),
                }
            }
            if real != file {
                // A link reaches the same contents, but is never fixed: the
                // file is fixed through its real path.
                let contents = self.entries[real].contents;
                self.set(file, true, contents);
            }
        }
        referenced
    }

    /// Adds an entry for a file that couldn't be read, under `key`.
    fn add_unreadable(&mut self, key: &Path, file: &Path, read_only: bool, detail: &str) {
        let contents = self.push_contents(FileContents {
            aliases: Vec::new(),
            markers: Markers::new(),
            errors: vec![ErrorDetails::could_not_parse(
                &file.to_string_lossy(),
                detail,
            )],
            line_count: None,
        });
        self.set(key, read_only, contents);
    }

    fn push_contents(&mut self, contents: FileContents) -> usize {
        self.contents.push(contents);
        self.contents.len() - 1
    }

    /// Points `path` at the given contents, and adds it to their aliases.
    ///
    /// A path already in the cache keeps its place.
    fn set(&mut self, path: &Path, read_only: bool, contents: usize) {
        self.entries.insert(
            path.to_path_buf(),
            Entry {
                read_only,
                contents,
            },
        );
        self.contents[contents].aliases.push(path.to_path_buf());
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::MarkerCache;
    use super::real_path::real_path;
    use crate::errors::ErrorDetails;
    use crate::options::Options;

    pub(super) fn options() -> Options {
        Options {
            include_globs: vec!["**/*.js".to_owned()],
            exclude_globs: Vec::new(),
            ignore_files: Vec::new(),
            comments: vec!["//".to_owned()],
            allow_empty_tags: false,
            root_marker: None,
            migration: None,
        }
    }

    /// Creates a root folder holding a `package.json` and the given files.
    ///
    /// The folder's path has its links resolved, so paths in the cache,
    /// which are resolved too, compare equal to paths built from it.
    pub(super) fn root(files: &[(&str, &str)]) -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = real_path(dir.path()).unwrap();
        fs::write(path.join("package.json"), "{}").unwrap();
        for (name, text) in files {
            let file = path.join(name);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, text).unwrap();
        }
        (dir, path)
    }

    pub(super) fn keys(cache: &MarkerCache) -> Vec<&Path> {
        cache.iter().map(|(path, _)| path).collect()
    }

    const TAGGED_A: &str = "// sync-start:x b.js\ncontent\n// sync-end:x\n";
    const TAGGED_B: &str = "// sync-start:x a.js\ncontent\n// sync-end:x\n";

    #[test]
    fn adds_each_file_in_the_order_given() {
        // Arrange
        let (_dir, root) = root(&[("a.js", ""), ("b.js", "")]);
        let files = [root.join("b.js"), root.join("a.js")];

        // Act
        let cache = MarkerCache::from_files(&options(), &files);

        // Assert
        assert_eq!(keys(&cache), vec![files[0].as_path(), files[1].as_path()]);
    }

    #[test]
    fn makes_the_requested_files_fixable() {
        // Arrange
        let (_dir, root) = root(&[("a.js", "")]);
        let file = root.join("a.js");

        // Act
        let cache = MarkerCache::from_files(&options(), std::slice::from_ref(&file));

        // Assert
        assert!(!cache.get(&file).unwrap().read_only);
    }

    #[test]
    fn adds_the_targets_of_the_requested_files_as_read_only() {
        // Arrange
        let (_dir, root) = root(&[("a.js", TAGGED_A), ("b.js", TAGGED_B)]);

        // Act
        let cache = MarkerCache::from_files(&options(), &[root.join("a.js")]);

        // Assert
        assert!(cache.get(&root.join("b.js")).unwrap().read_only);
    }

    #[test]
    fn reads_no_further_than_the_targets_of_the_requested_files() {
        // Arrange
        let (_dir, root) = root(&[
            ("a.js", TAGGED_A),
            ("b.js", "// sync-start:x c.js\ncontent\n// sync-end:x\n"),
            ("c.js", ""),
        ]);

        // Act
        let cache = MarkerCache::from_files(&options(), &[root.join("a.js")]);

        // Assert
        assert!(cache.get(&root.join("c.js")).is_none());
    }

    #[test]
    fn keeps_a_requested_file_fixable_when_another_targets_it() {
        // Arrange
        let (_dir, root) = root(&[("a.js", TAGGED_A), ("b.js", TAGGED_B)]);

        // Act
        let cache = MarkerCache::from_files(&options(), &[root.join("a.js"), root.join("b.js")]);

        // Assert
        assert!(!cache.get(&root.join("b.js")).unwrap().read_only);
    }

    #[test]
    fn stores_a_file_markers() {
        // Arrange
        let (_dir, root) = root(&[("a.js", TAGGED_A), ("b.js", TAGGED_B)]);
        let file = root.join("a.js");

        // Act
        let cache = MarkerCache::from_files(&options(), std::slice::from_ref(&file));

        // Assert
        assert_eq!(
            cache.get(&file).unwrap().markers.keys().collect::<Vec<_>>(),
            vec!["x"]
        );
    }

    #[test]
    fn stores_a_file_line_count() {
        // Arrange
        let (_dir, root) = root(&[("a.js", TAGGED_A), ("b.js", TAGGED_B)]);
        let file = root.join("a.js");

        // Act
        let cache = MarkerCache::from_files(&options(), std::slice::from_ref(&file));

        // Assert
        assert_eq!(cache.get(&file).unwrap().line_count, Some(3));
    }

    #[test]
    fn makes_a_file_its_own_alias() {
        // Arrange
        let (_dir, root) = root(&[("a.js", "")]);
        let file = root.join("a.js");

        // Act
        let cache = MarkerCache::from_files(&options(), std::slice::from_ref(&file));

        // Assert
        assert_eq!(
            cache.get(&file).unwrap().aliases,
            std::slice::from_ref(&file)
        );
    }

    #[test]
    fn reports_a_path_that_cannot_be_resolved() {
        // Arrange
        let (_dir, root) = root(&[]);
        let missing = root.join("missing.js");
        let detail = real_path(&missing).unwrap_err().to_string();

        // Act
        let cache = MarkerCache::from_files(&options(), std::slice::from_ref(&missing));

        // Assert
        assert_eq!(
            cache.get(&missing).unwrap().errors,
            [ErrorDetails::could_not_parse(
                &missing.to_string_lossy(),
                &detail
            )]
        );
    }

    #[test]
    fn reports_a_file_whose_root_cannot_be_found() {
        // Arrange
        let (_dir, root) = root(&[("a.js", "")]);
        let file = root.join("a.js");
        let options = Options {
            root_marker: Some("no-such-marker-anywhere.txt".to_owned()),
            ..options()
        };

        // Act
        let cache = MarkerCache::from_files(&options, std::slice::from_ref(&file));

        // Assert
        assert!(
            cache.get(&file).unwrap().errors[0]
                .reason
                .starts_with(&format!(
                    "Could not parse {}: Could not find marker",
                    file.display()
                ))
        );
    }

    #[test]
    fn adds_a_path_that_differs_from_its_real_path_as_read_only() {
        // Arrange
        let (_dir, root) = root(&[("a.js", "")]);
        let given = root.join("sub").join("..").join("a.js");

        // Act
        let cache = MarkerCache::from_files(&options(), std::slice::from_ref(&given));

        // Assert
        assert_eq!(
            cache
                .iter()
                .map(|(path, info)| (path, info.read_only))
                .collect::<Vec<_>>(),
            vec![
                (root.join("a.js").as_path(), false),
                (given.as_path(), true)
            ]
        );
    }
}
