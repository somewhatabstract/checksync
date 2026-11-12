use crate::types::PosixClass;

/// Check whether a byte belongs to a POSIX character class.
///
/// Only ASCII bytes belong to any class. Space counts only space, tab, line
/// feed and carriage return, not vertical tab or form feed.
///
/// # Arguments
///
/// * `class` - The class to check.
/// * `byte` - The byte to look for, compared exactly, without folding case.
///
/// # Returns
///
/// `true` if the byte is in the class.
#[must_use]
pub(crate) fn posix_class_contains(class: PosixClass, byte: u8) -> bool {
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
    use super::posix_class_contains;
    use crate::types::PosixClass;

    /// List the bytes from 1 to 255 that belong to a class.
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
