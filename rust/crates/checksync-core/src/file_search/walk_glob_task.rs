use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::glob::{compile_glob, compiled_glob_matches};
use crate::node_normalize::node_normalize;

use super::INCLUDE_GLOB_OPTIONS;
use super::glob_text::glob_text;
use super::is_base_excluded::is_base_excluded;
use super::is_excluded::is_excluded;
use super::join_glob_text::join_glob_text;
use super::pattern_name_limit::pattern_name_limit;
use super::pattern_names_hidden::pattern_names_hidden;
use super::should_walk_folder::should_walk_folder;
use super::types::{ExcludeGlobs, GlobTask};

/// Walk a task's folder and collect the files its pattern matches.
///
/// The task's folder may be reached through a link, but links found while
/// walking are neither followed nor listed, so only regular files are found.
/// A file is listed when the pattern matches its path relative to the working
/// folder and no exclude pattern does. Nothing is found if an exclude pattern
/// prunes the task's folder or one above it. A task whose folder doesn't exist, or
/// isn't a folder, finds nothing. An entry that can't be read is skipped.
///
/// # Arguments
///
/// * `task` - The folder to walk and the pattern to match.
/// * `excludes` - The compiled exclude patterns, for files and folders.
/// * `cwd` - The absolute working folder.
/// * `found` - Where to add the absolute paths of matching files.
///
/// # Errors
///
/// Any error reading a folder, other than its not existing or not being a
/// folder.
pub(super) fn walk_glob_task(
    task: &GlobTask,
    excludes: &ExcludeGlobs,
    cwd: &Path,
    found: &mut Vec<PathBuf>,
) -> io::Result<()> {
    let Some(pattern) = compile_glob(task.pattern.as_bytes(), INCLUDE_GLOB_OPTIONS) else {
        return Ok(());
    };
    if is_base_excluded(&task.base, &excludes.folders) {
        return Ok(());
    }
    let name_limit = pattern_name_limit(&task.pattern);
    let enter_hidden = pattern_names_hidden(&task.pattern);
    let base_text = if task.base == "." {
        ""
    } else {
        task.base.as_str()
    };
    let mut folders = vec![(cwd.join(&task.base), base_text.as_bytes().to_vec())];
    while let Some((folder, folder_text)) = folders.pop() {
        let entries = match fs::read_dir(&folder) {
            Ok(entries) => entries,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::NotFound | io::ErrorKind::NotADirectory
                ) =>
            {
                continue;
            }
            Err(error) => return Err(error),
        };
        let readable = entries
            .flatten()
            .filter_map(|entry| entry.file_type().ok().map(|file_type| (entry, file_type)));
        for (entry, file_type) in readable {
            let name = entry.file_name();
            let name = glob_text(&name);
            let text = join_glob_text(&folder_text, &name);
            if file_type.is_dir() {
                if should_walk_folder(&text, &name, &excludes.folders, name_limit, enter_hidden) {
                    folders.push((entry.path(), text));
                }
            } else if file_type.is_file()
                && compiled_glob_matches(&pattern, &text)
                && !is_excluded(&excludes.files, &text)
            {
                found.push(node_normalize(&entry.path()));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::walk_glob_task;
    use crate::file_search::EXCLUDE_GLOB_OPTIONS;
    use crate::file_search::compile_folder_exclude::compile_folder_exclude;
    use crate::file_search::types::{ExcludeGlobs, GlobTask};
    use crate::glob::compile_glob;

    fn task(base: &str, pattern: &str) -> GlobTask {
        GlobTask {
            base: base.to_owned(),
            pattern: pattern.to_owned(),
        }
    }

    fn excludes(patterns: &[&str]) -> ExcludeGlobs {
        ExcludeGlobs {
            files: patterns
                .iter()
                .filter_map(|pattern| compile_glob(pattern.as_bytes(), EXCLUDE_GLOB_OPTIONS))
                .collect(),
            folders: patterns
                .iter()
                .flat_map(|pattern| compile_folder_exclude(pattern))
                .collect(),
        }
    }

    fn write(root: &Path, file: &str) {
        let path = root.join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    fn walk(task: &GlobTask, excludes: &ExcludeGlobs, cwd: &Path) -> Vec<PathBuf> {
        let mut found = Vec::new();
        walk_glob_task(task, excludes, cwd, &mut found).unwrap();
        found.sort();
        found
    }

    #[test]
    fn finds_files_the_pattern_matches() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        write(cwd.path(), "src/b.ts");

        // Act
        let result = walk(&task("src", "src/*.js"), &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("src/a.js")]);
    }

    #[test]
    fn finds_files_in_nested_folders() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a/b/c.js");

        // Act
        let result = walk(&task(".", "**/*.js"), &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("a/b/c.js")]);
    }

    #[test]
    fn does_not_list_excluded_files() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");
        write(cwd.path(), "b.js");

        // Act
        let result = walk(&task(".", "*.js"), &excludes(&["b.js"]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("a.js")]);
    }

    #[test]
    fn does_not_walk_excluded_folders() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "node_modules/x.js");

        // Act
        let result = walk(
            &task(".", "**/*.js"),
            &excludes(&["node_modules/**"]),
            cwd.path(),
        );

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn does_not_walk_hidden_folders_for_wildcards() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), ".git/x.js");

        // Act
        let result = walk(&task(".", "**/*.js"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn walks_a_hidden_folder_the_pattern_names() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), ".dotdir/x.js");

        // Act
        let result = walk(&task(".dotdir", ".dotdir/**"), &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join(".dotdir/x.js")]);
    }

    #[test]
    fn does_not_list_files_deeper_than_the_pattern() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/nested/a.js");

        // Act
        let result = walk(&task("src", "src/*.js"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn gives_normalized_paths_outside_the_working_folder() {
        // Arrange
        let root = TempDir::new().unwrap();
        write(root.path(), "a.js");
        fs::create_dir(root.path().join("src")).unwrap();

        // Act
        let result = walk(
            &task("..", "../a.js"),
            &excludes(&[]),
            &root.path().join("src"),
        );

        // Assert
        assert_eq!(result, vec![root.path().join("a.js")]);
    }

    #[test]
    fn finds_nothing_for_a_folder_that_does_not_exist() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = walk(&task("missing", "missing/**"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn finds_nothing_when_the_folder_is_a_file() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");

        // Act
        let result = walk(&task("a.js", "a.js/*"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn finds_nothing_for_a_pattern_that_can_never_match() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");

        // Act
        let result = walk(&task(".", "[a"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn fails_for_a_folder_that_cannot_be_read() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        let mut found = Vec::new();

        // Act
        let result = walk_glob_task(
            &task("a\0b", "a\0b/*"),
            &excludes(&[]),
            cwd.path(),
            &mut found,
        );

        // Assert
        assert!(result.is_err());
    }

    #[cfg(unix)]
    #[test]
    fn does_not_list_or_follow_links_found_while_walking() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        fs::create_dir(cwd.path().join("links")).unwrap();
        std::os::unix::fs::symlink("../src", cwd.path().join("links/dir")).unwrap();
        std::os::unix::fs::symlink("../src/a.js", cwd.path().join("links/a.js")).unwrap();

        // Act
        let result = walk(&task("links", "links/**"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn walks_a_task_folder_reached_through_a_link() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        std::os::unix::fs::symlink("src", cwd.path().join("link")).unwrap();

        // Act
        let result = walk(&task("link", "link/**"), &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("link/a.js")]);
    }

    #[test]
    fn finds_nothing_when_an_exclude_prunes_the_task_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "lib/a.js");

        // Act
        let result = walk(&task("lib", "lib/**"), &excludes(&["lib"]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn does_not_match_a_file_itself_with_a_trailing_double_star() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");

        // Act
        let result = walk(&task(".", "*.js/**"), &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn finds_nothing_in_a_folder_a_wildcard_exclude_prunes() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "lib/a.js");

        // Act
        let result = walk(&task(".", "**"), &excludes(&["l*b"]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }
}
