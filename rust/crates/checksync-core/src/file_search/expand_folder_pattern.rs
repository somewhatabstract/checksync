use std::path::Path;

/// Turn an include pattern naming a folder into one for everything below it.
///
/// A pattern without a `*` that names a folder (not a link to one) becomes
/// `folder/**`, so `src` finds every file below `src`, as checksync's
/// JavaScript implementation does. A trailing `/` is dropped first. Anything
/// else is returned as it is.
///
/// # Arguments
///
/// * `pattern` - The include pattern, relative to `cwd`.
/// * `cwd` - The working folder.
///
/// # Returns
///
/// The pattern to search with.
#[must_use]
pub(super) fn expand_folder_pattern(pattern: &str, cwd: &Path) -> String {
    let names_folder = !pattern.contains('*')
        && std::fs::symlink_metadata(cwd.join(pattern)).is_ok_and(|metadata| metadata.is_dir());
    if names_folder {
        format!("{}/**", pattern.trim_end_matches('/'))
    } else {
        pattern.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::expand_folder_pattern;

    #[test]
    fn expands_a_folder_to_everything_below_it() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("src")).unwrap();

        // Act
        let result = expand_folder_pattern("src", cwd.path());

        // Assert
        assert_eq!(result, "src/**");
    }

    #[test]
    fn drops_a_trailing_slash_before_expanding() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("src")).unwrap();

        // Act
        let result = expand_folder_pattern("src/", cwd.path());

        // Assert
        assert_eq!(result, "src/**");
    }

    #[test]
    fn expands_the_working_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = expand_folder_pattern(".", cwd.path());

        // Assert
        assert_eq!(result, "./**");
    }

    #[test]
    fn keeps_a_file() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::write(cwd.path().join("a.js"), "").unwrap();

        // Act
        let result = expand_folder_pattern("a.js", cwd.path());

        // Assert
        assert_eq!(result, "a.js");
    }

    #[test]
    fn keeps_a_path_that_does_not_exist() {
        // Arrange
        let cwd = TempDir::new().unwrap();

        // Act
        let result = expand_folder_pattern("missing", cwd.path());

        // Assert
        assert_eq!(result, "missing");
    }

    // Windows doesn't allow `*` in a folder name, so only Unix can have a
    // folder that a pattern with a star names exactly.
    #[cfg(unix)]
    #[test]
    fn keeps_a_pattern_with_a_star() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("s*")).unwrap();

        // Act
        let result = expand_folder_pattern("s*", cwd.path());

        // Assert
        assert_eq!(result, "s*");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_a_link_to_a_folder() {
        // Arrange
        let cwd = TempDir::new().unwrap();
        fs::create_dir(cwd.path().join("src")).unwrap();
        std::os::unix::fs::symlink("src", cwd.path().join("link")).unwrap();

        // Act
        let result = expand_folder_pattern("link", cwd.path());

        // Assert
        assert_eq!(result, "link");
    }
}
