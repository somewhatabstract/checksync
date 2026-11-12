use super::posix_class_from_name::posix_class_from_name;
use super::types::ClassSyntax;

/// Work out whether a `[:` inside a bracket set starts a POSIX class.
///
/// It does when the first `]` after the `[:` comes straight after a `:`
/// that isn't part of the `[:` itself. The name is whatever lies between,
/// so `[:a]b:]` isn't a class (its first `]` follows `a`), while `[::]` is a
/// class with an empty, unknown name.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the `[` of the `[:` is in the pattern.
///
/// # Returns
///
/// `ClassSyntax::Known` with the class and the index just past its `:]`,
/// `ClassSyntax::Unknown` if the name isn't a known class, or
/// `ClassSyntax::NotAClass` if the `[` is just an ordinary member of the
/// set.
#[must_use]
pub(super) fn read_bracket_class(pattern: &[u8], index: usize) -> ClassSyntax {
    let name_start = index + 2;
    let Some(offset) = pattern[name_start..].iter().position(|&byte| byte == b']') else {
        return ClassSyntax::NotAClass;
    };
    let close = name_start + offset;
    if close == name_start || pattern[close - 1] != b':' {
        return ClassSyntax::NotAClass;
    }
    match posix_class_from_name(&pattern[name_start..close - 1]) {
        Some(class) => ClassSyntax::Known(class, close + 1),
        None => ClassSyntax::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{ClassSyntax, PosixClass};
    use super::read_bracket_class;

    #[test]
    fn reads_a_known_class() {
        // Arrange
        let pattern = b"[[:alpha:]]";

        // Act
        let result = read_bracket_class(pattern, 1);

        // Assert
        assert_eq!(result, ClassSyntax::Known(PosixClass::Alpha, 10));
    }

    #[test]
    fn reports_an_unknown_class_name() {
        // Arrange
        let pattern = b"[[:foo:]]";

        // Act
        let result = read_bracket_class(pattern, 1);

        // Assert
        assert_eq!(result, ClassSyntax::Unknown);
    }

    #[test]
    fn reports_an_empty_class_name_as_unknown() {
        // Arrange
        let pattern = b"[[::]]";

        // Act
        let result = read_bracket_class(pattern, 1);

        // Assert
        assert_eq!(result, ClassSyntax::Unknown);
    }

    #[test]
    fn is_not_a_class_without_a_closing_bracket() {
        // Arrange
        let pattern = b"[[:alpha";

        // Act
        let result = read_bracket_class(pattern, 1);

        // Assert
        assert_eq!(result, ClassSyntax::NotAClass);
    }

    #[test]
    fn is_not_a_class_when_the_first_bracket_does_not_follow_a_colon() {
        // Arrange
        let pattern = b"[[:a]b:]]";

        // Act
        let result = read_bracket_class(pattern, 1);

        // Assert
        assert_eq!(result, ClassSyntax::NotAClass);
    }

    #[test]
    fn does_not_count_the_opening_colon_as_the_closing_one() {
        // Arrange
        let pattern = b"[[:]]";

        // Act
        let result = read_bracket_class(pattern, 1);

        // Assert
        assert_eq!(result, ClassSyntax::NotAClass);
    }
}
