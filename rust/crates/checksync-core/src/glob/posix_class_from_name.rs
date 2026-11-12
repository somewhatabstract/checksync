use super::types::PosixClass;

/// Look up a POSIX character class by the name written between `[:` and `:]`.
///
/// Names are case-sensitive, so `ALPHA` isn't a class.
///
/// # Arguments
///
/// * `name` - The class name, such as `alpha`.
///
/// # Returns
///
/// The class, or `None` if the name isn't one of the twelve known classes.
#[must_use]
pub(super) fn posix_class_from_name(name: &[u8]) -> Option<PosixClass> {
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

#[cfg(test)]
mod tests {
    use super::super::types::PosixClass;
    use super::posix_class_from_name;

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
}
