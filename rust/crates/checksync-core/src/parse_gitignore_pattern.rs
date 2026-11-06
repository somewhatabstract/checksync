use crate::types::GitignorePattern;

/// Whether a byte is one of the glob characters git looks for.
fn is_glob_special(byte: u8) -> bool {
    matches!(byte, b'*' | b'?' | b'[' | b'\\')
}

/// Read one `.gitignore` pattern, as git's `parse_path_pattern` does.
///
/// A leading `!` negates the pattern and a trailing `/` limits it to
/// folders; neither is kept in the pattern. A pattern with no other `/`
/// matches the last part of a path, at any depth.
///
/// # Arguments
///
/// * `line` - The line, already trimmed, that isn't blank or a comment.
///
/// # Returns
///
/// The pattern, with what git works out about it.
#[must_use]
pub(crate) fn parse_gitignore_pattern(line: &[u8]) -> GitignorePattern {
    let (negated, rest) = match line.strip_prefix(b"!") {
        Some(rest) => (true, rest),
        None => (false, line),
    };
    let (dir_only, pattern) = match rest.strip_suffix(b"/") {
        Some(pattern) => (true, pattern),
        None => (false, rest),
    };
    // As in git, the literal prefix and `*literal` check look at the text
    // before the trailing `/` is removed; the `/` itself isn't special.
    let literal_prefix = rest
        .iter()
        .position(|&byte| is_glob_special(byte))
        .unwrap_or(rest.len())
        .min(pattern.len());
    let ends_with = rest.first() == Some(&b'*') && !rest[1..].iter().any(|&b| is_glob_special(b));
    GitignorePattern {
        pattern: pattern.to_vec(),
        literal_prefix,
        negated,
        dir_only,
        basename_only: !pattern.contains(&b'/'),
        ends_with,
    }
}

#[cfg(test)]
mod tests {
    use super::parse_gitignore_pattern;
    use crate::types::GitignorePattern;

    #[test]
    fn reads_a_plain_name() {
        // Arrange
        let line = b"build";

        // Act
        let result = parse_gitignore_pattern(line);

        // Assert
        assert_eq!(
            result,
            GitignorePattern {
                pattern: b"build".to_vec(),
                literal_prefix: 5,
                negated: false,
                dir_only: false,
                basename_only: true,
                ends_with: false,
            }
        );
    }

    #[test]
    fn reads_a_negated_folder_pattern_with_a_slash() {
        // Arrange
        let line = b"!a/b*/";

        // Act
        let result = parse_gitignore_pattern(line);

        // Assert
        assert_eq!(
            result,
            GitignorePattern {
                pattern: b"a/b*".to_vec(),
                literal_prefix: 3,
                negated: true,
                dir_only: true,
                basename_only: false,
                ends_with: false,
            }
        );
    }

    #[test]
    fn notes_an_asterisk_followed_by_literal_text() {
        // Arrange
        let line = b"*.log/";

        // Act
        let result = parse_gitignore_pattern(line);

        // Assert
        assert_eq!(
            result,
            GitignorePattern {
                pattern: b"*.log".to_vec(),
                literal_prefix: 0,
                negated: false,
                dir_only: true,
                basename_only: true,
                ends_with: true,
            }
        );
    }

    #[test]
    fn does_not_note_an_asterisk_followed_by_more_globs() {
        // Arrange
        let line = b"*.l?g";

        // Act
        let result = parse_gitignore_pattern(line);

        // Assert
        assert!(!result.ends_with);
    }

    #[test]
    fn reads_a_lone_exclamation_mark_as_an_empty_negated_pattern() {
        // Arrange
        let line = b"!";

        // Act
        let result = parse_gitignore_pattern(line);

        // Assert
        assert_eq!(
            result,
            GitignorePattern {
                pattern: Vec::new(),
                literal_prefix: 0,
                negated: true,
                dir_only: false,
                basename_only: true,
                ends_with: false,
            }
        );
    }
}
