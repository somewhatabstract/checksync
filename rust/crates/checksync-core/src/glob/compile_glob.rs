use super::bytes_before_nul::bytes_before_nul;
use super::tokenize_glob::tokenize_glob;
use super::types::{CompiledGlob, GlobOptions, HiddenNames};

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
        hidden: if options.pathname {
            options.hidden
        } else {
            HiddenNames::MatchAll
        },
    })
}

#[cfg(test)]
mod tests {
    use super::super::TEST_OPTIONS;
    use super::super::types::{CompiledGlob, GlobOptions, GlobToken, HiddenNames, UnitMatcher};
    use super::compile_glob;

    /// Compile `?` with the given options and report the hidden names kept.
    fn hidden(pathname: bool, hidden: HiddenNames) -> Option<HiddenNames> {
        let options = GlobOptions {
            pathname,
            casefold: false,
            hidden,
            unicode: false,
        };
        compile_glob(b"?", options).map(|glob| glob.hidden)
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
                tokens: vec![GlobToken::One(UnitMatcher::Any)],
                options: TEST_OPTIONS,
                hidden: HiddenNames::MatchAll,
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
        assert_eq!(result, Some(vec![GlobToken::One(UnitMatcher::Any)]));
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
    fn keeps_the_hidden_names_option_in_pathname_mode() {
        // Arrange
        let option = HiddenNames::SkipDotSegments;

        // Act
        let result = hidden(true, option);

        // Assert
        assert_eq!(result, Some(HiddenNames::SkipDotSegments));
    }

    #[test]
    fn matches_all_hidden_names_without_pathname_mode() {
        // Arrange
        let option = HiddenNames::SkipDotNames;

        // Act
        let result = hidden(false, option);

        // Assert
        assert_eq!(result, Some(HiddenNames::MatchAll));
    }
}
