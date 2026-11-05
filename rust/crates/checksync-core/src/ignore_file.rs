use std::borrow::Cow;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::gitignore_pattern_matches::gitignore_pattern_matches;
use crate::node_relative::node_relative;
use crate::read_gitignore_patterns::read_gitignore_patterns;
use crate::types::{GitignorePattern, IgnoreDecision};

/// A loaded `.gitignore`-style file that decides about paths in its folder.
///
/// Patterns are read and matched as git reads and matches them, ignoring
/// case as checksync's JavaScript implementation does. A path inside an
/// ignored folder stays ignored even if a later pattern negates the path
/// itself.
#[derive(Debug)]
pub struct IgnoreFile {
    folder: PathBuf,
    patterns: Vec<GitignorePattern>,
}

impl IgnoreFile {
    /// Read an ignore file.
    ///
    /// Two things differ from checksync's JavaScript implementation, which
    /// uses the `ignore` package; in both, this follows git. Ignoring case
    /// applies only to ASCII letters, and in a pattern such as `a**/b`, the
    /// `**` can match across folders, so it matches `a/x/b`.
    ///
    /// # Arguments
    ///
    /// * `path` - The absolute path of the ignore file.
    ///
    /// # Returns
    ///
    /// The ignore file, governing the folder it's in.
    ///
    /// # Errors
    ///
    /// Any error reading the file.
    pub fn load(path: &Path) -> io::Result<Self> {
        let contents = std::fs::read(path)?;
        Ok(Self {
            folder: path.parent().map(Path::to_path_buf).unwrap_or_default(),
            patterns: read_gitignore_patterns(&contents),
        })
    }

    /// Decide what this ignore file says about a file.
    ///
    /// Only files inside the ignore file's folder get an opinion; anything
    /// beside or above it, including a sibling folder whose name merely
    /// starts with this folder's name, gets [`IgnoreDecision::NoOpinion`].
    /// The folders above the file are checked first: if any is ignored, so
    /// is the file, even if a later pattern negates the file itself, as in
    /// git. Otherwise the last pattern that matches the file decides.
    ///
    /// # Arguments
    ///
    /// * `file_path` - The absolute path of the file.
    ///
    /// # Returns
    ///
    /// Whether the file is ignored, unignored, or neither.
    #[must_use]
    pub fn decide(&self, file_path: &Path) -> IgnoreDecision {
        let relative = node_relative(&self.folder, &self.folder, file_path);
        let outside = relative.as_os_str().is_empty()
            || relative.is_absolute()
            || relative.components().next() == Some(Component::ParentDir);
        if outside {
            return IgnoreDecision::NoOpinion;
        }
        let relative = path_bytes(&relative);
        let relative = relative.as_ref();
        let in_ignored_folder = relative
            .iter()
            .enumerate()
            .filter(|&(_, &byte)| byte == b'/')
            .any(|(slash, _)| {
                self.last_match(&relative[..slash], true)
                    .is_some_and(|pattern| !pattern.negated)
            });
        if in_ignored_folder {
            return IgnoreDecision::Ignored;
        }
        match self.last_match(relative, false) {
            Some(pattern) if pattern.negated => IgnoreDecision::Unignored,
            Some(_) => IgnoreDecision::Ignored,
            None => IgnoreDecision::NoOpinion,
        }
    }

    /// Find the last pattern that matches a path, which is the one that decides.
    fn last_match(&self, path: &[u8], is_dir: bool) -> Option<&GitignorePattern> {
        self.patterns
            .iter()
            .rev()
            .find(|pattern| gitignore_pattern_matches(pattern, path, is_dir, true))
    }
}

/// Get a relative path's bytes, with `/` separating folders, for matching.
///
/// On Unix these are the path's own bytes, as git matches them, so a name
/// that isn't valid UTF-8 can still match a pattern with the same bytes.
#[cfg(unix)]
fn path_bytes(path: &Path) -> Cow<'_, [u8]> {
    use std::os::unix::ffi::OsStrExt;
    Cow::Borrowed(path.as_os_str().as_bytes())
}

/// Get a relative path's bytes, with `/` separating folders, for matching.
///
/// Windows paths are UTF-16, so they're converted to UTF-8 and their `\`
/// separators to `/`.
#[cfg(not(unix))]
fn path_bytes(path: &Path) -> Cow<'_, [u8]> {
    use crate::normalize_separators::normalize_separators;
    Cow::Owned(normalize_separators(&path.to_string_lossy()).into_bytes())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::TempDir;

    use super::IgnoreFile;
    use crate::types::IgnoreDecision;

    /// Write `contents` to `.gitignore` in `folder` and load it.
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
}
