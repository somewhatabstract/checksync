use super::bytes_before_nul::bytes_before_nul;
use super::tokenize_glob::tokenize_glob;
use super::types::{CompiledGlob, GlobOptions};

/// Compile a glob pattern so it can be matched against many texts.
///
/// A NUL byte ends the pattern, as it would a C string.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `options` - How to treat slashes, letter case and hidden names.
///
/// # Returns
///
/// The compiled pattern, or `None` if it can never match anything: it ends
/// with a `\`, or has a malformed bracket set.
#[must_use]
pub(crate) fn compile_glob(pattern: &[u8], options: GlobOptions) -> Option<CompiledGlob> {
    let tokens = tokenize_glob(bytes_before_nul(pattern), options)?;
    Some(CompiledGlob {
        tokens,
        options,
        hides_dots: options.pathname && !options.dot,
    })
}

#[cfg(test)]
mod tests {
    use super::super::TEST_OPTIONS;
    use super::super::types::{ByteMatcher, CompiledGlob, GlobOptions, GlobToken};
    use super::compile_glob;

    /// Compile `?` with the given options and report whether dots are hidden.
    fn hides_dots(pathname: bool, dot: bool) -> Option<bool> {
        let options = GlobOptions {
            pathname,
            casefold: false,
            dot,
        };
        compile_glob(b"?", options).map(|glob| glob.hides_dots)
    }

    #[test]
    fn compiles_the_pattern_with_its_options() {
        // Arrange
        let pattern = b"?";

        // Act
        let result = compile_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(
            result,
            Some(CompiledGlob {
                tokens: vec![GlobToken::One(ByteMatcher::Any)],
                options: TEST_OPTIONS,
                hides_dots: false,
            })
        );
    }

    #[test]
    fn ends_the_pattern_at_a_nul_byte() {
        // Arrange
        let pattern = b"?\0[";

        // Act
        let result = compile_glob(pattern, TEST_OPTIONS).map(|glob| glob.tokens);

        // Assert
        assert_eq!(result, Some(vec![GlobToken::One(ByteMatcher::Any)]));
    }

    #[test]
    fn rejects_a_pattern_that_can_never_match() {
        // Arrange
        let pattern = b"[ab";

        // Act
        let result = compile_glob(pattern, TEST_OPTIONS);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn hides_dots_in_pathname_mode_without_dot() {
        // Arrange
        let (pathname, dot) = (true, false);

        // Act
        let result = hides_dots(pathname, dot);

        // Assert
        assert_eq!(result, Some(true));
    }

    #[test]
    fn does_not_hide_dots_with_dot() {
        // Arrange
        let (pathname, dot) = (true, true);

        // Act
        let result = hides_dots(pathname, dot);

        // Assert
        assert_eq!(result, Some(false));
    }

    #[test]
    fn does_not_hide_dots_without_pathname_mode() {
        // Arrange
        let (pathname, dot) = (false, false);

        // Act
        let result = hides_dots(pathname, dot);

        // Assert
        assert_eq!(result, Some(false));
    }
}
