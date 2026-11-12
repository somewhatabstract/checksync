use std::io;
use std::path::{Path, PathBuf};

use crate::glob::compile_glob;

use super::EXCLUDE_GLOB_OPTIONS;
use super::compile_folder_exclude::compile_folder_exclude;
use super::sort_paths_like_javascript::sort_paths_like_javascript;
use super::types::{ExcludeGlobs, GlobPlan};
use super::walk_glob_task::walk_glob_task;

/// Find the files a search plan matches.
///
/// Every task is walked with the same exclude patterns, which, as in
/// fast-glob, match names starting with `.` too. An exclude pattern removes
/// a file whose path it matches, and prunes a folder whose path it matches,
/// with everything in it, wherever that folder is on the way to the file. The results are
/// absolute paths, each listed once, sorted as JavaScript sorts strings.
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
pub(super) fn find_files(plan: &GlobPlan, cwd: &Path) -> io::Result<Vec<PathBuf>> {
    let excludes = ExcludeGlobs {
        files: plan
            .excludes
            .iter()
            .filter_map(|exclude| compile_glob(exclude.as_bytes(), EXCLUDE_GLOB_OPTIONS))
            .collect(),
        folders: plan
            .excludes
            .iter()
            .flat_map(|exclude| compile_folder_exclude(exclude))
            .collect(),
    };
    let mut found = Vec::new();
    for task in &plan.tasks {
        walk_glob_task(task, &excludes, cwd, &mut found)?;
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
    fn applies_the_excludes_to_every_task() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");
        write(cwd.path(), "src/a.js");
        let plan = GlobPlan {
            tasks: vec![task(".", "*.js"), task("src", "src/*.js")],
            excludes: vec!["**/a.js".to_owned(), "[unclosed".to_owned()],
        };

        // Act
        let result = find_files(&plan, cwd.path()).unwrap();

        // Assert
        assert!(result.is_empty());
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
        let result = find_files(&plan, cwd.path());

        // Assert
        assert!(result.is_err());
    }
}
