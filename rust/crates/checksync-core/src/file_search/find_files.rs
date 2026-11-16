use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use super::compile_exclude_globs::compile_exclude_globs;
use super::sort_paths_like_javascript::sort_paths_like_javascript;
use super::types::{GetFilesError, GlobPlan};
use super::walk_glob_folder::walk_glob_folder;

/// Find the files a search plan matches.
///
/// Tasks that start from the same folder share one walk. Every walk uses the
/// same exclude patterns, which, as in fast-glob, match names starting with
/// `.` too. An exclude pattern removes a file whose path it matches, and
/// prunes a folder whose path it matches, with everything in it, wherever
/// that folder is on the way to the file. The results are absolute paths,
/// each listed once, sorted as JavaScript sorts strings.
///
/// # Arguments
///
/// * `plan` - The tasks to walk and the patterns to exclude.
/// * `cwd` - The absolute working folder.
///
/// # Returns
///
/// The matching files.
///
/// # Errors
///
/// Any error reading a folder, other than its not existing.
pub(super) fn find_files(plan: &GlobPlan, cwd: &Path) -> Result<Vec<PathBuf>, GetFilesError> {
    let excludes = compile_exclude_globs(&plan.excludes, cwd);
    let mut patterns_by_base: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    for task in &plan.tasks {
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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::TempDir;

    use super::find_files;
    use crate::file_search::types::{GlobPlan, GlobTask};

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
        let result = find_files(&plan, cwd.path()).unwrap();

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
        let result = find_files(&plan, cwd.path()).unwrap();

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
        let result = find_files(&plan, cwd.path()).unwrap();

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
        let result = find_files(&plan, cwd.path()).unwrap();

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
        let result = find_files(&plan, &root.path().join("src")).unwrap();

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
        let result = find_files(&plan, cwd.path()).map(|_| ());

        // Assert
        assert!(result.unwrap_err().to_string().starts_with("cannot read "));
    }
}
