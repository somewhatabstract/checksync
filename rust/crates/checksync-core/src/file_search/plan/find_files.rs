//! Finding the files a search plan matches, in JavaScript order.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use super::GlobPlan;
use crate::file_search::GetFilesError;
use crate::file_search::excludes::ExcludeGlobs;
use crate::file_search::walk::walk_glob_folder;

impl GlobPlan {
    /// Finds the files the plan matches.
    ///
    /// Tasks that start from the same folder share one walk. Every walk uses
    /// the same exclude patterns, which, as in fast-glob, match names starting
    /// with `.` too. An exclude pattern removes a file whose path it matches,
    /// and prunes a folder whose path it matches, with everything in it,
    /// wherever that folder is on the way to the file. The results are
    /// absolute paths, each listed once, sorted as JavaScript sorts strings.
    /// `cwd` is the absolute working folder.
    ///
    /// # Errors
    ///
    /// Returns [`GetFilesError::Io`] for any error reading a folder, other
    /// than its not existing.
    pub(in crate::file_search) fn find_files(
        &self,
        cwd: &Path,
    ) -> Result<Vec<PathBuf>, GetFilesError> {
        let excludes = ExcludeGlobs::new(&self.excludes, cwd);
        let mut patterns_by_base: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
        for task in &self.tasks {
            patterns_by_base
                .entry(&task.base)
                .or_default()
                .push(&task.pattern);
        }
        let mut found = Vec::new();
        for (base, patterns) in patterns_by_base {
            walk_glob_folder(base, &patterns, &excludes, cwd, &mut found)?;
        }
        sort_paths_like_javascript(&mut found);
        Ok(found)
    }
}

/// Sorts paths as JavaScript sorts strings, and drops duplicates.
///
/// JavaScript compares strings by UTF-16 code unit, which orders some text
/// differently from comparing bytes or characters. Each path is compared as
/// text with `/` between names, which is how checksync's JavaScript
/// implementation sorts the paths fast-glob gives it.
fn sort_paths_like_javascript(paths: &mut Vec<PathBuf>) {
    paths.sort_by_cached_key(|path| utf16_key(path));
    paths.dedup();
}

/// Gets a path's text, with `/` between names, as UTF-16 code units.
fn utf16_key(path: &Path) -> Vec<u16> {
    let text = path.to_string_lossy();
    #[cfg(not(unix))]
    let text = text.replace('\\', "/");
    text.encode_utf16().collect()
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::sort_paths_like_javascript;
    use crate::file_search::plan::{GlobPlan, GlobTask};

    fn task(base: &str, pattern: &str) -> GlobTask {
        GlobTask {
            base: base.to_owned(),
            pattern: pattern.to_owned(),
        }
    }

    fn write(root: &Path, file: &str) {
        let path = root.join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    #[test]
    fn lists_each_file_once_in_javascript_order() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");
        write(cwd.path(), "B.js");
        let plan = GlobPlan {
            tasks: vec![task(".", "*.js"), task(".", "a.*")],
            excludes: vec![],
        };

        // Act
        let result = plan.find_files(cwd.path()).unwrap();

        // Assert
        assert_eq!(
            result,
            vec![cwd.path().join("B.js"), cwd.path().join("a.js")]
        );
    }

    #[test]
    fn walks_each_task_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        write(cwd.path(), "lib/b.js");
        let plan = GlobPlan {
            tasks: vec![task("src", "src/*.js"), task("lib", "lib/*.js")],
            excludes: vec![],
        };

        // Act
        let result = plan.find_files(cwd.path()).unwrap();

        // Assert
        assert_eq!(
            result,
            vec![cwd.path().join("lib/b.js"), cwd.path().join("src/a.js")]
        );
    }

    #[test]
    fn applies_the_excludes_to_every_task() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");
        write(cwd.path(), "src/a.js");
        let plan = GlobPlan {
            tasks: vec![task(".", "*.js"), task("src", "src/*.js")],
            excludes: vec!["**/a.js".to_owned()],
        };

        // Act
        let result = plan.find_files(cwd.path()).unwrap();

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn prunes_folders_with_an_exclude_ending_in_a_double_star() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "node_modules/a.js");
        let plan = GlobPlan {
            tasks: vec![task("node_modules", "node_modules/*.js")],
            excludes: vec!["node_modules/**".to_owned()],
        };

        // Act
        let result = plan.find_files(cwd.path()).unwrap();

        // Assert
        assert!(result.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn applies_an_absolute_wildcard_exclude_to_relative_paths() {
        // Arrange
        let root = TempDir::new().unwrap();
        write(root.path(), "src/x/gen/a.js");
        write(root.path(), "src/x/b.js");
        let plan = GlobPlan {
            tasks: vec![task(".", "**/*.js")],
            excludes: vec![format!("{}/**/gen/**", root.path().display())],
        };

        // Act
        let result = plan.find_files(&root.path().join("src")).unwrap();

        // Assert
        assert_eq!(result, vec![root.path().join("src/x/b.js")]);
    }

    #[test]
    fn fails_when_a_folder_cannot_be_read() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        let plan = GlobPlan {
            tasks: vec![task("a\0b", "a\0b/*")],
            excludes: vec![],
        };

        // Act
        let result = plan.find_files(cwd.path()).map(|_| ());

        // Assert
        assert!(result.unwrap_err().to_string().starts_with("cannot read "));
    }

    fn paths(values: &[&str]) -> Vec<PathBuf> {
        values.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn sorts_capital_letters_before_lowercase() {
        // Arrange
        let mut sorted = paths(&["/r/a.js", "/r/B.js"]);

        // Act
        sort_paths_like_javascript(&mut sorted);

        // Assert
        assert_eq!(sorted, paths(&["/r/B.js", "/r/a.js"]));
    }

    #[test]
    fn sorts_by_utf16_code_unit_rather_than_character() {
        // Arrange
        // U+FF5E is one UTF-16 unit, 0xFF5E; U+1F600 is two, starting 0xD83D,
        // so JavaScript puts the emoji first, unlike character order.
        let mut sorted = paths(&["/r/\u{ff5e}", "/r/\u{1f600}"]);

        // Act
        sort_paths_like_javascript(&mut sorted);

        // Assert
        assert_eq!(sorted, paths(&["/r/\u{1f600}", "/r/\u{ff5e}"]));
    }

    #[test]
    fn drops_duplicates() {
        // Arrange
        let mut sorted = paths(&["/r/a.js", "/r/b.js", "/r/a.js"]);

        // Act
        sort_paths_like_javascript(&mut sorted);

        // Assert
        assert_eq!(sorted, paths(&["/r/a.js", "/r/b.js"]));
    }
}
