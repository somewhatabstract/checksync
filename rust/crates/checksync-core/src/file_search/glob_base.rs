/// Find the folder a pattern's files must be in, before any glob characters.
///
/// The names before the first one with a glob character (`*`, `?`, `[` or a
/// `\` escape) can only match themselves, so walking can start there. The
/// last name is never part of the folder, since it's what files must match.
///
/// # Arguments
///
/// * `pattern` - The pattern, relative to the working folder, with `/`
///   between names and no leading `./`.
///
/// # Returns
///
/// The folder, with `/` between names, or `.` for the working folder.
#[must_use]
pub(super) fn glob_base(pattern: &str) -> String {
    let names: Vec<&str> = pattern.split('/').collect();
    let folder_names = &names[..names.len() - 1];
    let literal_count = folder_names
        .iter()
        .take_while(|name| !name.contains(['*', '?', '[', '\\']))
        .count();
    let base = folder_names[..literal_count].join("/");
    match base.as_str() {
        "" if pattern.starts_with('/') => "/".to_owned(),
        "" => ".".to_owned(),
        _ => base,
    }
}

#[cfg(test)]
mod tests {
    use super::glob_base;

    #[test]
    fn uses_the_working_folder_for_a_pattern_without_folders() {
        // Arrange
        let pattern = "*.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, ".");
    }

    #[test]
    fn uses_the_folders_before_a_glob() {
        // Arrange
        let pattern = "src/lib/*.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "src/lib");
    }

    #[test]
    fn uses_the_folders_of_a_plain_file_path() {
        // Arrange
        let pattern = "src/one.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "src");
    }

    #[test]
    fn stops_at_a_folder_with_a_glob() {
        // Arrange
        let pattern = "src/*/lib/a.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "src");
    }

    #[test]
    fn stops_at_a_double_star() {
        // Arrange
        let pattern = "src/**/a.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "src");
    }

    #[test]
    fn stops_at_a_question_mark() {
        // Arrange
        let pattern = "s?c/a.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, ".");
    }

    #[test]
    fn stops_at_a_bracket_set() {
        // Arrange
        let pattern = "[st]rc/a.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, ".");
    }

    #[test]
    fn stops_at_an_escape() {
        // Arrange
        let pattern = "a\\*b/c.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, ".");
    }

    #[test]
    fn keeps_parent_folders() {
        // Arrange
        let pattern = "../other/**";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "../other");
    }

    #[test]
    fn keeps_the_root_of_an_absolute_pattern() {
        // Arrange
        let pattern = "/a/*.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "/a");
    }

    #[test]
    fn uses_the_root_for_a_pattern_directly_under_it() {
        // Arrange
        let pattern = "/*.js";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "/");
    }

    #[test]
    fn uses_the_folder_before_a_trailing_slash() {
        // Arrange
        let pattern = "src/";

        // Act
        let result = glob_base(pattern);

        // Assert
        assert_eq!(result, "src");
    }
}
