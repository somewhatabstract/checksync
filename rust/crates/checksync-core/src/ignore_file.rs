use std::io;
use std::path::{Component, Path, PathBuf};

use ignore::Match;
use ignore::gitignore::{Gitignore, GitignoreBuilder};

use crate::escape_glob_braces::escape_glob_braces;
use crate::node_relative::node_relative;
use crate::types::IgnoreDecision;

/// A loaded ignore file, in `.gitignore` syntax, that decides about paths in
/// its own folder.
///
/// It matches the way checksync's JavaScript implementation uses the
/// `ignore` package: patterns ignore case, and a path inside an ignored
/// folder stays ignored even if a later pattern negates the path itself.
#[derive(Debug)]
pub struct IgnoreFile {
    folder: PathBuf,
    matcher: Gitignore,
}

impl IgnoreFile {
    /// Read an ignore file.
    ///
    /// Patterns mean what they mean to git. A byte order mark at the start
    /// is skipped, braces match themselves, and a pattern that can't be
    /// parsed, such as an unclosed `[`, matches nothing, as does a line
    /// that's only `!`. Invalid UTF-8 becomes U+FFFD.
    ///
    /// Two things differ from checksync's JavaScript implementation. POSIX
    /// character classes, such as `[[:alpha:]]`, aren't supported, and
    /// ignoring case applies only to ASCII letters, as in git.
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
        let bytes = std::fs::read(path)?;
        let contents = String::from_utf8_lossy(&bytes);
        let contents = contents.strip_prefix('\u{feff}').unwrap_or(&contents);
        Ok(Self::from_contents(path, contents))
    }

    /// Build an ignore file from its contents, as if it were at `path`.
    fn from_contents(path: &Path, contents: &str) -> Self {
        let folder = path.parent().map(Path::to_path_buf).unwrap_or_default();
        let mut builder = GitignoreBuilder::new(&folder);
        // Setting case insensitivity can't fail; the `Result` is only there
        // for future options.
        let _ = builder.case_insensitive(true);
        // Git skips an unclosed `[`; the crate would match it literally.
        builder.allow_unclosed_class(false);
        for line in contents.lines() {
            // Git ignores a lone `!`; the crate would read it as unignoring
            // every path.
            if line.trim_end() == "!" {
                continue;
            }
            // A pattern that can't be parsed is skipped, so it matches
            // nothing, as with git.
            let _ = builder.add_line(None, &escape_glob_braces(line));
        }
        // Building only fails for patterns already rejected above.
        let matcher = builder.build().ok().unwrap_or_else(Gitignore::empty);
        Self { folder, matcher }
    }

    /// Decide what this ignore file says about a file.
    ///
    /// Only files inside the ignore file's folder get an opinion; anything
    /// beside or above it, including a sibling folder whose name merely
    /// starts with this folder's name, gets [`IgnoreDecision::NoOpinion`].
    /// The folders above the file are checked first: if any is ignored, so
    /// is the file, even if a later pattern negates the file itself. Git and
    /// the `ignore` package both work this way, but the `ignore` crate's own
    /// matching checks the file first.
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
        let in_ignored_folder = relative
            .ancestors()
            .skip(1)
            .filter(|folder| !folder.as_os_str().is_empty())
            .any(|folder| self.matcher.matched(folder, true).is_ignore());
        if in_ignored_folder {
            return IgnoreDecision::Ignored;
        }
        match self.matcher.matched(&relative, false) {
            Match::Ignore(_) => IgnoreDecision::Ignored,
            Match::Whitelist(_) => IgnoreDecision::Unignored,
            Match::None => IgnoreDecision::NoOpinion,
        }
    }
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
