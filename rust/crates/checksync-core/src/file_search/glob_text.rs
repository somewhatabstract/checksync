use std::borrow::Cow;
use std::ffi::OsStr;

/// Get the bytes a glob pattern is matched against for a file or folder name.
///
/// On Unix, a name is matched by its raw bytes, so names that aren't valid
/// UTF-8 can still match. Elsewhere, its text is used, with anything that
/// isn't valid Unicode replaced.
///
/// # Arguments
///
/// * `name` - The file or folder name.
///
/// # Returns
///
/// The bytes to match.
#[must_use]
pub(super) fn glob_text(name: &OsStr) -> Cow<'_, [u8]> {
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        Cow::Borrowed(name.as_bytes())
    }
    #[cfg(not(unix))]
    {
        match name.to_string_lossy() {
            Cow::Borrowed(text) => Cow::Borrowed(text.as_bytes()),
            Cow::Owned(text) => Cow::Owned(text.into_bytes()),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::glob_text;

    #[test]
    fn gives_the_bytes_of_a_name() {
        // Arrange
        let name = OsStr::new("é.js");

        // Act
        let result = glob_text(name);

        // Assert
        assert_eq!(result.as_ref(), "é.js".as_bytes());
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_raw_bytes_of_a_name_that_is_not_utf8() {
        // Arrange
        use std::os::unix::ffi::OsStrExt;
        let name = OsStr::from_bytes(b"a\xff.js");

        // Act
        let result = glob_text(name);

        // Assert
        assert_eq!(result.as_ref(), b"a\xff.js");
    }
}
