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
/// * `options` - How to treat slashes and letter case.
///
/// # Returns
///
/// The compiled pattern, or `None` if it can never match anything: it ends
/// with a `\`, or has a malformed bracket set.
#[must_use]
pub(crate) fn compile_glob(pattern: &[u8], options: GlobOptions) -> Option<CompiledGlob> {
    let tokens = tokenize_glob(bytes_before_nul(pattern), options)?;
    Some(CompiledGlob { tokens, options })
}

#[cfg(test)]
mod tests {
    use super::super::types::{ByteMatcher, CompiledGlob, GlobOptions, GlobToken};
    use super::compile_glob;

    #[test]
    fn compiles_the_pattern_with_its_options() {
        // Arrange
        let options = GlobOptions {
            pathname: true,
            casefold: true,
            dot: true,
        };

        // Act
        let result = compile_glob(b"?", options);

        // Assert
        assert_eq!(
            result,
            Some(CompiledGlob {
                tokens: vec![GlobToken::One(ByteMatcher::Any)],
                options,
            })
        );
    }

    #[test]
    fn ends_the_pattern_at_a_nul_byte() {
        // Arrange
        let pattern = b"?\0[";

        // Act
        let result = compile_glob(pattern, GlobOptions::default());

        // Assert
        assert_eq!(
            result,
            Some(CompiledGlob {
                tokens: vec![GlobToken::One(ByteMatcher::Any)],
                options: GlobOptions::default(),
            })
        );
    }

    #[test]
    fn rejects_a_pattern_that_can_never_match() {
        // Arrange
        let pattern = b"[ab";

        // Act
        let result = compile_glob(pattern, GlobOptions::default());

        // Assert
        assert_eq!(result, None);
    }
}
