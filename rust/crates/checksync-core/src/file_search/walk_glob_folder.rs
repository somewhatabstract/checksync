use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::node_normalize::node_normalize;

use super::INCLUDE_GLOB_OPTIONS;
use super::compile_pattern_set::compile_pattern_set;
use super::glob_text::glob_text;
use super::is_base_excluded::is_base_excluded;
use super::join_glob_text::join_glob_text;
use super::matches_pattern_set::matches_pattern_set;
use super::pattern_name_limit::pattern_name_limit;
use super::pattern_names_hidden::pattern_names_hidden;
use super::should_walk_folder::should_walk_folder;
use super::types::{ExcludeGlobs, GetFilesError};

/// Walk a folder and collect the files any of its include patterns match.
///
/// The folder may be reached through a link, but links found while walking
/// are neither followed nor listed, so only regular files are found. A file
/// is listed when an include pattern matches its path relative to the
/// working folder, as a glob or by its text, and no exclude pattern does.
/// Nothing is found if an exclude pattern prunes the folder or one above it,
/// or if the folder doesn't exist or isn't a folder. An entry that can't be
/// read is skipped.
///
/// # Arguments
///
/// * `base` - The folder to walk, relative to the working folder, with `/`
///   between names; `.` for the working folder itself.
/// * `patterns` - The include patterns whose files are below `base`.
/// * `excludes` - The compiled exclude patterns, for files and folders.
/// * `cwd` - The absolute working folder.
/// * `found` - Where to add the absolute paths of matching files.
///
/// # Errors
///
/// Any error reading a folder, other than its not existing or not being a
/// folder.
pub(super) fn walk_glob_folder(
    base: &str,
    patterns: &[&str],
    excludes: &ExcludeGlobs,
    cwd: &Path,
    found: &mut Vec<PathBuf>,
) -> Result<(), GetFilesError> {
    if is_base_excluded(base, &excludes.folders) {
        return Ok(());
    }
    let includes = compile_pattern_set(patterns.iter().copied(), INCLUDE_GLOB_OPTIONS);
    let limits: Option<Vec<usize>> = patterns
        .iter()
        .map(|pattern| pattern_name_limit(pattern))
        .collect();
    let name_limit = limits.and_then(|limits| limits.into_iter().max());
    let enter_hidden = patterns.iter().any(|pattern| pattern_names_hidden(pattern));
    let base_text = if base == "." { "" } else { base };
    let mut folders = vec![(cwd.join(base), base_text.as_bytes().to_vec())];
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
            Err(error) => {
                return Err(GetFilesError::Io {
                    path: folder,
                    error,
                });
            }
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
                && matches_pattern_set(&includes, &text)
                && !matches_pattern_set(&excludes.files, &text)
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

    use super::walk_glob_folder;
    use crate::file_search::EXCLUDE_GLOB_OPTIONS;
    use crate::file_search::compile_pattern_set::compile_pattern_set;
    use crate::file_search::folder_exclude_forms::folder_exclude_forms;
    use crate::file_search::types::ExcludeGlobs;

    fn excludes(patterns: &[&str]) -> ExcludeGlobs {
        ExcludeGlobs {
            files: compile_pattern_set(patterns.iter().copied(), EXCLUDE_GLOB_OPTIONS),
            folders: compile_pattern_set(
                patterns
                    .iter()
                    .flat_map(|pattern| folder_exclude_forms(pattern)),
                EXCLUDE_GLOB_OPTIONS,
            ),
        }
    }

    fn write(root: &Path, file: &str) {
        let path = root.join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    fn walk(base: &str, patterns: &[&str], excludes: &ExcludeGlobs, cwd: &Path) -> Vec<PathBuf> {
        let mut found = Vec::new();
        walk_glob_folder(base, patterns, excludes, cwd, &mut found).unwrap();
        found.sort();
        found
    }

    #[test]
    fn finds_files_a_pattern_matches() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        write(cwd.path(), "src/b.ts");

        // Act
        let result = walk("src", &["src/*.js"], &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("src/a.js")]);
    }

    #[test]
    fn finds_files_any_of_its_patterns_match() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        write(cwd.path(), "src/b.ts");
        write(cwd.path(), "src/c.log");

        // Act
        let result = walk("src", &["src/*.js", "src/*.ts"], &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(
            result,
            vec![cwd.path().join("src/a.js"), cwd.path().join("src/b.ts")]
        );
    }

    #[test]
    fn walks_as_deep_as_the_deepest_pattern_allows() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        write(cwd.path(), "src/n/b.js");

        // Act
        let result = walk(
            "src",
            &["src/*.js", "src/*/*.js"],
            &excludes(&[]),
            cwd.path(),
        );

        // Assert
        assert_eq!(
            result,
            vec![cwd.path().join("src/a.js"), cwd.path().join("src/n/b.js")]
        );
    }

    #[test]
    fn finds_files_in_nested_folders() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a/b/c.js");

        // Act
        let result = walk(".", &["**/*.js"], &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("a/b/c.js")]);
    }

    #[test]
    fn finds_a_file_named_exactly_by_a_pattern() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "app/[slug]/page.tsx");

        // Act
        let result = walk("app", &["app/[slug]/page.tsx"], &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("app/[slug]/page.tsx")]);
    }

    #[test]
    fn does_not_list_excluded_files() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");
        write(cwd.path(), "b.js");

        // Act
        let result = walk(".", &["*.js"], &excludes(&["b.js"]), cwd.path());

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
            ".",
            &["**/*.js"],
            &excludes(&["node_modules/**"]),
            cwd.path(),
        );

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn finds_nothing_in_a_folder_a_wildcard_exclude_prunes() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "lib/a.js");

        // Act
        let result = walk(".", &["**"], &excludes(&["l*b"]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn finds_nothing_when_an_exclude_prunes_the_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "lib/a.js");

        // Act
        let result = walk("lib", &["lib/**"], &excludes(&["lib"]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn does_not_walk_hidden_folders_for_wildcards() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), ".git/x.js");

        // Act
        let result = walk(".", &["**/*.js"], &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn walks_a_hidden_folder_a_pattern_names() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), ".dotdir/x.js");

        // Act
        let result = walk(".dotdir", &[".dotdir/**"], &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join(".dotdir/x.js")]);
    }

    #[test]
    fn does_not_list_files_deeper_than_the_patterns() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/nested/a.js");

        // Act
        let result = walk("src", &["src/*.js"], &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn does_not_match_a_file_itself_with_a_trailing_double_star() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");

        // Act
        let result = walk(".", &["*.js/**"], &excludes(&[]), cwd.path());

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
        let result = walk("..", &["../a.js"], &excludes(&[]), &root.path().join("src"));

        // Assert
        assert_eq!(result, vec![root.path().join("a.js")]);
    }

    #[test]
    fn finds_nothing_for_a_folder_that_does_not_exist() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = walk("missing", &["missing/**"], &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn finds_nothing_when_the_folder_is_a_file() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "a.js");

        // Act
        let result = walk("a.js", &["a.js/*"], &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[test]
    fn fails_with_the_folder_that_cannot_be_read() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        let mut found = Vec::new();

        // Act
        let result = walk_glob_folder("a\0b", &["a\0b/*"], &excludes(&[]), cwd.path(), &mut found);

        // Assert
        assert!(result.unwrap_err().to_string().starts_with("cannot read "));
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
        let result = walk("links", &["links/**"], &excludes(&[]), cwd.path());

        // Assert
        assert!(result.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn walks_a_folder_reached_through_a_link() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        write(cwd.path(), "src/a.js");
        std::os::unix::fs::symlink("src", cwd.path().join("link")).unwrap();

        // Act
        let result = walk("link", &["link/**"], &excludes(&[]), cwd.path());

        // Assert
        assert_eq!(result, vec![cwd.path().join("link/a.js")]);
    }
}
