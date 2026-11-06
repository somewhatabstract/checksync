/// Check a byte against a POSIX character class, as git's `wildmatch` does.
///
/// Classes are ASCII only, as in git: no byte above `0x7F` belongs to any of
/// them. git's notion of space is narrower than C's: it's only tab, line
/// feed, carriage return and space.
///
/// # Arguments
///
/// * `name` - The class name between `[:` and `:]`, such as `alpha`.
/// * `byte` - The byte to check, already lowercased if `casefold` is set.
/// * `casefold` - Whether case is ignored, which makes `upper` match
///   lowercase letters too.
///
/// # Returns
///
/// Whether the byte is in the class, or `None` if there's no class with
/// that name.
#[must_use]
pub(crate) fn matches_posix_class(name: &[u8], byte: u8, casefold: bool) -> Option<bool> {
    let is_space = matches!(byte, b'\t' | b'\n' | b'\r' | b' ');
    let matched = match name {
        b"alnum" => byte.is_ascii_alphanumeric(),
        b"alpha" => byte.is_ascii_alphabetic(),
        b"blank" => matches!(byte, b' ' | b'\t'),
        b"cntrl" => byte.is_ascii_control(),
        b"digit" => byte.is_ascii_digit(),
        b"graph" => byte.is_ascii_graphic(),
        b"lower" => byte.is_ascii_lowercase(),
        b"print" => matches!(byte, 0x20..=0x7E),
        b"punct" => byte.is_ascii_punctuation(),
        b"space" => is_space,
        b"upper" => byte.is_ascii_uppercase() || (casefold && byte.is_ascii_lowercase()),
        b"xdigit" => byte.is_ascii_hexdigit(),
        _ => return None,
    };
    Some(matched)
}

#[cfg(test)]
mod tests {
    use super::matches_posix_class;

    #[test]
    fn matches_a_letter_as_alpha() {
        // Arrange
        let byte = b'q';

        // Act
        let result = matches_posix_class(b"alpha", byte, false);

        // Assert
        assert_eq!(result, Some(true));
    }

    #[test]
    fn accepts_a_member_of_each_class() {
        // Arrange
        let members: [(&[u8], u8); 12] = [
            (b"alnum", b'7'),
            (b"alpha", b'Q'),
            (b"blank", b'\t'),
            (b"cntrl", 0x7F),
            (b"digit", b'0'),
            (b"graph", b'~'),
            (b"lower", b'z'),
            (b"print", b' '),
            (b"punct", b'!'),
            (b"space", b'\n'),
            (b"upper", b'A'),
            (b"xdigit", b'f'),
        ];

        // Act
        let result: Vec<Option<bool>> = members
            .iter()
            .map(|(name, byte)| matches_posix_class(name, *byte, false))
            .collect();

        // Assert
        assert_eq!(result, vec![Some(true); 12]);
    }

    #[test]
    fn puts_no_byte_above_ascii_in_any_class() {
        // Arrange
        let names: [&[u8]; 12] = [
            b"alnum", b"alpha", b"blank", b"cntrl", b"digit", b"graph", b"lower", b"print",
            b"punct", b"space", b"upper", b"xdigit",
        ];

        // Act
        let result: Vec<Option<bool>> = names
            .iter()
            .map(|name| matches_posix_class(name, 0xC3, true))
            .collect();

        // Assert
        assert_eq!(result, vec![Some(false); 12]);
    }

    #[test]
    fn does_not_count_a_form_feed_as_space() {
        // Arrange
        let byte = 0x0C;

        // Act
        let result = matches_posix_class(b"space", byte, false);

        // Assert
        assert_eq!(result, Some(false));
    }

    #[test]
    fn counts_a_carriage_return_as_space() {
        // Arrange
        let byte = b'\r';

        // Act
        let result = matches_posix_class(b"space", byte, false);

        // Assert
        assert_eq!(result, Some(true));
    }

    #[test]
    fn matches_a_lowercase_letter_as_upper_when_ignoring_case() {
        // Arrange
        let byte = b'q';

        // Act
        let result = matches_posix_class(b"upper", byte, true);

        // Assert
        assert_eq!(result, Some(true));
    }

    #[test]
    fn does_not_match_a_lowercase_letter_as_upper_otherwise() {
        // Arrange
        let byte = b'q';

        // Act
        let result = matches_posix_class(b"upper", byte, false);

        // Assert
        assert_eq!(result, Some(false));
    }

    #[test]
    fn rejects_an_unknown_class() {
        // Arrange
        let name = b"word";

        // Act
        let result = matches_posix_class(name, b'q', false);

        // Assert
        assert_eq!(result, None);
    }
}
