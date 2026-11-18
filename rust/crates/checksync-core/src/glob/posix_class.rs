//! POSIX character classes such as `[:alpha:]`: recognizing them in a bracket
//! set and checking which bytes they hold.

/// A POSIX character class that a bracket set can name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PosixClass {
    /// Letters and digits.
    Alnum,
    /// Letters.
    Alpha,
    /// Space and tab.
    Blank,
    /// Control bytes.
    Cntrl,
    /// Decimal digits.
    Digit,
    /// Visible bytes, excluding space.
    Graph,
    /// Lowercase letters.
    Lower,
    /// Visible bytes and space.
    Print,
    /// Visible bytes that are neither letters nor digits.
    Punct,
    /// Space, tab, line feed and carriage return.
    Space,
    /// Uppercase letters.
    Upper,
    /// Hexadecimal digits.
    Xdigit,
}

/// What a `[:` inside a bracket set turned out to start.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ClassSyntax {
    /// Not a class: the `[` is an ordinary member of the set.
    NotAClass,
    /// A known class, and the index just past its closing `:]`.
    Known(PosixClass, usize),
    /// A class with a name that isn't recognized.
    Unknown,
}

/// Works out whether the `[:` at `index`, inside a bracket set, starts a POSIX class.
///
/// It does when the first `]` after the `[:` comes straight after a `:` that
/// isn't part of the `[:` itself. The name is whatever lies between, so `[:a]b:]`
/// isn't a class (its first `]` follows `a`), while `[::]` is a class with an
/// empty, unknown name. Returns [`ClassSyntax::Known`] with the class and the
/// index just past its `:]`, [`ClassSyntax::Unknown`] if the name isn't a known
/// class, or [`ClassSyntax::NotAClass`] if the `[` is just an ordinary member of
/// the set.
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

/// Returns the POSIX character class named between `[:` and `:]`, if it's known.
///
/// Names are case-sensitive, so `ALPHA` isn't a class. Returns `None` if the name
/// isn't one of the twelve known classes.
#[must_use]
fn posix_class_from_name(name: &[u8]) -> Option<PosixClass> {
    match name {
        b"alnum" => Some(PosixClass::Alnum),
        b"alpha" => Some(PosixClass::Alpha),
        b"blank" => Some(PosixClass::Blank),
        b"cntrl" => Some(PosixClass::Cntrl),
        b"digit" => Some(PosixClass::Digit),
        b"graph" => Some(PosixClass::Graph),
        b"lower" => Some(PosixClass::Lower),
        b"print" => Some(PosixClass::Print),
        b"punct" => Some(PosixClass::Punct),
        b"space" => Some(PosixClass::Space),
        b"upper" => Some(PosixClass::Upper),
        b"xdigit" => Some(PosixClass::Xdigit),
        _ => None,
    }
}

/// Checks whether a byte belongs to a POSIX character class.
///
/// The byte is compared exactly, without folding case. Only ASCII bytes belong to
/// any class. Space counts only space, tab, line feed and carriage return, not
/// vertical tab or form feed.
#[must_use]
pub(super) fn posix_class_contains(class: PosixClass, byte: u8) -> bool {
    match class {
        PosixClass::Alnum => byte.is_ascii_alphanumeric(),
        PosixClass::Alpha => byte.is_ascii_alphabetic(),
        PosixClass::Blank => matches!(byte, b' ' | b'\t'),
        PosixClass::Cntrl => byte.is_ascii_control(),
        PosixClass::Digit => byte.is_ascii_digit(),
        PosixClass::Graph => byte.is_ascii_graphic(),
        PosixClass::Lower => byte.is_ascii_lowercase(),
        PosixClass::Print => byte.is_ascii_graphic() || byte == b' ',
        PosixClass::Punct => byte.is_ascii_punctuation(),
        PosixClass::Space => matches!(byte, b' ' | b'\t' | b'\n' | b'\r'),
        PosixClass::Upper => byte.is_ascii_uppercase(),
        PosixClass::Xdigit => byte.is_ascii_hexdigit(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ClassSyntax, PosixClass, posix_class_contains, posix_class_from_name, read_bracket_class,
    };

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

    #[test]
    fn finds_every_known_class() {
        // Arrange
        let names: [&[u8]; 12] = [
            b"alnum", b"alpha", b"blank", b"cntrl", b"digit", b"graph", b"lower", b"print",
            b"punct", b"space", b"upper", b"xdigit",
        ];

        // Act
        let result: Vec<Option<PosixClass>> = names
            .iter()
            .map(|name| posix_class_from_name(name))
            .collect();

        // Assert
        assert_eq!(
            result,
            vec![
                Some(PosixClass::Alnum),
                Some(PosixClass::Alpha),
                Some(PosixClass::Blank),
                Some(PosixClass::Cntrl),
                Some(PosixClass::Digit),
                Some(PosixClass::Graph),
                Some(PosixClass::Lower),
                Some(PosixClass::Print),
                Some(PosixClass::Punct),
                Some(PosixClass::Space),
                Some(PosixClass::Upper),
                Some(PosixClass::Xdigit),
            ]
        );
    }

    #[test]
    fn rejects_an_unknown_name() {
        // Arrange
        let name = b"foo";

        // Act
        let result = posix_class_from_name(name);

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_name_in_the_wrong_case() {
        // Arrange
        let name = b"ALPHA";

        // Act
        let result = posix_class_from_name(name);

        // Assert
        assert_eq!(result, None);
    }

    /// Returns the bytes from 1 to 255 that belong to a class.
    fn members(class: PosixClass) -> Vec<u8> {
        (1..=255)
            .filter(|&byte| posix_class_contains(class, byte))
            .collect()
    }

    #[test]
    fn alnum_holds_letters_and_digits() {
        // Arrange
        let expected: Vec<u8> = (b'0'..=b'9')
            .chain(b'A'..=b'Z')
            .chain(b'a'..=b'z')
            .collect();

        // Act
        let result = members(PosixClass::Alnum);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn alpha_holds_letters() {
        // Arrange
        let expected: Vec<u8> = (b'A'..=b'Z').chain(b'a'..=b'z').collect();

        // Act
        let result = members(PosixClass::Alpha);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn blank_holds_tab_and_space() {
        // Arrange
        let expected = vec![b'\t', b' '];

        // Act
        let result = members(PosixClass::Blank);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn cntrl_holds_control_bytes_and_delete() {
        // Arrange
        let expected: Vec<u8> = (1..=0x1f).chain([0x7f]).collect();

        // Act
        let result = members(PosixClass::Cntrl);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn digit_holds_decimal_digits() {
        // Arrange
        let expected: Vec<u8> = (b'0'..=b'9').collect();

        // Act
        let result = members(PosixClass::Digit);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn graph_holds_visible_bytes() {
        // Arrange
        let expected: Vec<u8> = (0x21..=0x7e).collect();

        // Act
        let result = members(PosixClass::Graph);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn lower_holds_lowercase_letters() {
        // Arrange
        let expected: Vec<u8> = (b'a'..=b'z').collect();

        // Act
        let result = members(PosixClass::Lower);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn print_holds_visible_bytes_and_space() {
        // Arrange
        let expected: Vec<u8> = (0x20..=0x7e).collect();

        // Act
        let result = members(PosixClass::Print);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn punct_holds_visible_bytes_that_are_not_letters_or_digits() {
        // Arrange
        let expected: Vec<u8> = (0x21..=0x2f)
            .chain(0x3a..=0x40)
            .chain(0x5b..=0x60)
            .chain(0x7b..=0x7e)
            .collect();

        // Act
        let result = members(PosixClass::Punct);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn space_holds_tab_line_feed_carriage_return_and_space() {
        // Arrange
        let expected = vec![b'\t', b'\n', b'\r', b' '];

        // Act
        let result = members(PosixClass::Space);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn upper_holds_uppercase_letters() {
        // Arrange
        let expected: Vec<u8> = (b'A'..=b'Z').collect();

        // Act
        let result = members(PosixClass::Upper);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn xdigit_holds_hexadecimal_digits() {
        // Arrange
        let expected: Vec<u8> = (b'0'..=b'9')
            .chain(b'A'..=b'F')
            .chain(b'a'..=b'f')
            .collect();

        // Act
        let result = members(PosixClass::Xdigit);

        // Assert
        assert_eq!(result, expected);
    }
}
