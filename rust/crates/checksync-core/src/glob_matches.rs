use crate::compile_glob::compile_glob;
use crate::compiled_glob_matches::compiled_glob_matches;
use crate::types::GlobOptions;

/// Check whether the whole of a text matches a glob pattern, as git does.
///
/// Matching works on bytes. `?` matches any one byte, `*` any run of bytes,
/// `[...]` one byte from a set, and `\` makes the next byte literal. A NUL
/// byte ends the pattern or the text, as it would a C string. A pattern
/// ending in `\` or holding a malformed bracket set matches nothing.
/// `GlobOptions` describes how `pathname` and `casefold` change this.
///
/// This compiles the pattern every time it's called, so code inside the
/// crate that matches one pattern against many texts compiles it once
/// instead. It's public so the glob conformance vectors can check it.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `text` - The text to match against it.
/// * `options` - How to treat slashes and letter case.
///
/// # Returns
///
/// `true` if the pattern matches the whole text.
#[must_use]
pub fn glob_matches(pattern: &[u8], text: &[u8], options: GlobOptions) -> bool {
    compile_glob(pattern, options).is_some_and(|glob| compiled_glob_matches(&glob, text))
}

#[cfg(test)]
mod tests {
    use super::glob_matches;
    use crate::types::GlobOptions;

    #[test]
    fn matches_a_matching_text() {
        // Arrange
        let pattern = b"a*";

        // Act
        let result = glob_matches(pattern, b"abc", GlobOptions::default());

        // Assert
        assert!(result);
    }

    #[test]
    fn does_not_match_a_different_text() {
        // Arrange
        let pattern = b"a*";

        // Act
        let result = glob_matches(pattern, b"bc", GlobOptions::default());

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_nothing_with_a_malformed_pattern() {
        // Arrange
        let pattern = b"[a";

        // Act
        let result = glob_matches(pattern, b"[a", GlobOptions::default());

        // Assert
        assert!(!result);
    }
}
