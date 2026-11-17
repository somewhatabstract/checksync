//! Loaded ignore files, and how they decide about paths in their folder.

use super::decide::decide_path;
use super::pattern::GitignorePattern;
use crate::node_path::node_relative;
use crate::types::IgnoreDecision;
use std::path::{Component, Path, PathBuf};
use std::{fs, io};

/// A loaded `.gitignore`-style file that decides about paths in its folder.
///
/// Patterns are read and matched as git reads and matches them, ignoring the case
/// of ASCII letters. A path inside an ignored folder stays ignored even if a later
/// pattern negates the path itself.
#[derive(Debug)]
pub struct IgnoreFile {
    /// The folder the ignore file is in, which it governs.
    folder: PathBuf,
    /// The ignore file's patterns, in order.
    patterns: Vec<GitignorePattern>,
}

impl IgnoreFile {
    /// Reads the ignore file at `path`, an absolute path, to govern its folder.
    ///
    /// Two things differ from checksync's JavaScript implementation, which uses the
    /// `ignore` package; in both, this follows git:
    ///
    /// - Ignoring case applies only to ASCII letters.
    /// - On Unix, a file name that isn't valid UTF-8 is matched by its bytes. The
    ///   JavaScript decodes it first, turning the bad bytes into U+FFFD.
    ///
    /// # Errors
    ///
    /// Returns any error from reading the file.
    pub fn load(path: &Path) -> io::Result<Self> {
        let contents = fs::read(path)?;
        Ok(Self {
            folder: path.parent().map(Path::to_path_buf).unwrap_or_default(),
            patterns: parse(&contents),
        })
    }

    /// Decides what this ignore file says about the file at `file_path`, an absolute path.
    ///
    /// Only files inside the ignore file's folder get an opinion; anything beside or
    /// above it, including a sibling folder whose name merely starts with this
    /// folder's name, gets [`IgnoreDecision::NoOpinion`]. The folders above the file
    /// are checked first: if any is ignored, so is the file, even if a later pattern
    /// negates the file itself, as in git. Otherwise the last pattern that matches
    /// the file decides.
    #[must_use]
    pub fn decide(&self, file_path: &Path) -> IgnoreDecision {
        relative_path(&self.folder, file_path).map_or(IgnoreDecision::NoOpinion, |relative| {
            decide_path(&self.patterns, &relative)
        })
    }
}

/// Returns the patterns in the raw contents of a `.gitignore`-style file.
///
/// A UTF-8 byte order mark at the very start is skipped, and lines end at each
/// line feed. The patterns come in the order they appear.
#[must_use]
pub(super) fn parse(contents: &[u8]) -> Vec<GitignorePattern> {
    let contents = contents.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(contents);
    contents
        .split(|&byte| byte == b'\n')
        .filter_map(GitignorePattern::parse)
        .collect()
}

/// Returns a file's path inside an ignore file's folder, as patterns see it.
///
/// `folder` and `file_path` are absolute. Both are normalized first, so `..`
/// segments are resolved. The result has `/` between names: on Unix, it's the
/// path's raw bytes, so names that aren't valid UTF-8 are kept as they are;
/// elsewhere it's the path's text with `/` separators. Returns `None` if the file
/// isn't inside the folder, including when it is the folder itself.
#[must_use]
fn relative_path(folder: &Path, file_path: &Path) -> Option<Vec<u8>> {
    let relative = node_relative(folder, folder, file_path);
    let outside = matches!(
        relative.components().next(),
        None | Some(Component::ParentDir | Component::RootDir | Component::Prefix(_))
    );
    (!outside).then(|| path_bytes(&relative))
}

/// Returns a relative path's raw bytes, which already use `/` separators.
#[cfg(unix)]
fn path_bytes(path: &Path) -> Vec<u8> {
    use std::os::unix::ffi::OsStrExt;
    path.as_os_str().as_bytes().to_vec()
}

/// Returns a relative path's text with `/` separators.
#[cfg(not(unix))]
fn path_bytes(path: &Path) -> Vec<u8> {
    crate::separators::normalize_separators(&path.to_string_lossy()).into_bytes()
}

#[cfg(test)]
mod tests {
    use super::super::pattern::GLOB_OPTIONS;
    use super::{IgnoreFile, parse, relative_path};
    use crate::glob::CompiledGlob;
    use crate::types::IgnoreDecision;
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    /// Writes `contents` to `.gitignore` in `folder` and loads it.
    fn ignore_file(folder: &Path, contents: &str) -> IgnoreFile {
        fs::create_dir_all(folder).unwrap();
        let path = folder.join(".gitignore");
        fs::write(&path, contents).unwrap();
        IgnoreFile::load(&path).unwrap()
    }

    #[test]
    fn ignores_a_matching_file() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "*.log\n");

        // Act
        let result = file.decide(&dir.path().join("a.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn ignores_case() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "*.log\n");

        // Act
        let result = file.decide(&dir.path().join("A.LOG"));

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn unignores_a_negated_file() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "*.log\n!keep.log\n");

        // Act
        let result = file.decide(&dir.path().join("keep.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::Unignored);
    }

    #[test]
    fn keeps_a_negated_file_in_an_ignored_folder_ignored() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "logs/\n!logs/keep.log\n");

        // Act
        let result = file.decide(&dir.path().join("logs/keep.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn does_not_ignore_files_in_a_folder_unignored_again() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "logs/\n!logs/\n");

        // Act
        let result = file.decide(&dir.path().join("logs/x.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn has_no_opinion_on_a_sibling_folder_sharing_its_name() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(&dir.path().join("a"), "*\n");

        // Act
        let result = file.decide(&dir.path().join("ab/x.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn has_no_opinion_on_its_own_folder() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "*\n");

        // Act
        let result = file.decide(dir.path());

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn keeps_the_patterns_after_one_it_cannot_parse() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "[\n*.log\n");

        // Act
        let result = file.decide(&dir.path().join("a.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn matches_nothing_with_an_unclosed_bracket() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "foo[ab\n");

        // Act
        let result = file.decide(&dir.path().join("foo[ab"));

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn skips_a_byte_order_mark() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "\u{feff}a.log\n");

        // Act
        let result = file.decide(&dir.path().join("a.log"));

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn skips_a_line_that_is_only_an_exclamation_mark() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "!\n");

        // Act
        let result = file.decide(&dir.path().join("x.js"));

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[test]
    fn matches_braces_literally() {
        // Arrange
        let dir = TempDir::new().unwrap();
        let file = ignore_file(dir.path(), "{a,b}\n");

        // Act
        let result = file.decide(&dir.path().join("a"));

        // Assert
        assert_eq!(result, IgnoreDecision::NoOpinion);
    }

    #[cfg(unix)]
    #[test]
    fn matches_a_name_that_is_not_utf8_by_its_bytes() {
        // Arrange
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;
        let dir = TempDir::new().unwrap();
        let path = dir.path().join(".gitignore");
        fs::write(&path, b"caf\xE9\n").unwrap();
        let file = IgnoreFile::load(&path).unwrap();

        // Act
        let result = file.decide(&dir.path().join(OsStr::from_bytes(b"caf\xE9")));

        // Assert
        assert_eq!(result, IgnoreDecision::Ignored);
    }

    #[test]
    fn reports_a_missing_file() {
        // Arrange
        let dir = TempDir::new().unwrap();

        // Act
        let result = IgnoreFile::load(&dir.path().join("missing"));

        // Assert
        assert!(result.is_err());
    }

    /// Returns the globs of the patterns read from `contents`.
    fn globs(contents: &[u8]) -> Vec<CompiledGlob> {
        parse(contents)
            .into_iter()
            .map(|pattern| pattern.glob)
            .collect()
    }

    /// Compiles each of `patterns` as an ignore file would.
    fn compiled(patterns: &[&[u8]]) -> Vec<CompiledGlob> {
        patterns
            .iter()
            .map(|pattern| CompiledGlob::try_new(pattern, GLOB_OPTIONS).unwrap())
            .collect()
    }

    #[test]
    fn reads_each_line_in_order() {
        // Arrange
        let contents = b"a\n\n# c\nb";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"a", b"b"]));
    }

    #[test]
    fn skips_a_byte_order_mark_at_the_start() {
        // Arrange
        let contents = b"\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"a"]));
    }

    #[test]
    fn keeps_a_second_byte_order_mark() {
        // Arrange
        let contents = b"\xEF\xBB\xBF\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"\xEF\xBB\xBFa"]));
    }

    #[test]
    fn keeps_a_byte_order_mark_after_the_first_line() {
        // Arrange
        let contents = b"x\n\xEF\xBB\xBFa\n";

        // Act
        let result = globs(contents);

        // Assert
        assert_eq!(result, compiled(&[b"x", b"\xEF\xBB\xBFa"]));
    }

    fn root() -> PathBuf {
        std::env::temp_dir().join("root")
    }

    #[test]
    fn finds_the_path_inside_the_folder_with_slashes() {
        // Arrange
        let file = root().join("a").join("b.js");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, Some(b"a/b.js".to_vec()));
    }

    #[test]
    fn resolves_parent_segments() {
        // Arrange
        let file = root().join("a").join("..").join("b.js");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, Some(b"b.js".to_vec()));
    }

    #[test]
    fn finds_nothing_for_a_file_outside_the_folder() {
        // Arrange
        let file = root().join("..").join("b.js");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_nothing_for_a_sibling_folder_sharing_its_name() {
        // Arrange
        let folder = root().join("a");
        let file = root().join("ab").join("x.log");

        // Act
        let result = relative_path(&folder, &file);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn finds_nothing_for_the_folder_itself() {
        // Arrange
        let folder = root();

        // Act
        let result = relative_path(&folder, &folder);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn keeps_a_name_starting_with_two_dots() {
        // Arrange
        let file = root().join("..b");

        // Act
        let result = relative_path(&root(), &file);

        // Assert
        assert_eq!(result, Some(b"..b".to_vec()));
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_raw_bytes_of_a_name_that_is_not_utf8() {
        // Arrange
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;
        let file = root().join(OsStr::from_bytes(b"caf\xE9"));

        // Act
        let result = relative_path(Path::new(&root()), &file);

        // Assert
        assert_eq!(result, Some(b"caf\xE9".to_vec()));
    }
}
