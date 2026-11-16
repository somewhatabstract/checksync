/// Add a name to a folder's glob text, with a `/` between them.
///
/// The working folder's text is empty, so names in it have no folder part,
/// and a folder whose text already ends in `/`, such as the root, gets no
/// second one.
///
/// # Arguments
///
/// * `folder` - The folder's text, relative to the working folder.
/// * `name` - The name to add.
///
/// # Returns
///
/// The text for the name inside the folder.
#[must_use]
pub(super) fn join_glob_text(folder: &[u8], name: &[u8]) -> Vec<u8> {
    let mut text = Vec::with_capacity(folder.len() + 1 + name.len());
    text.extend_from_slice(folder);
    if !folder.is_empty() && !folder.ends_with(b"/") {
        text.push(b'/');
    }
    text.extend_from_slice(name);
    text
}

#[cfg(test)]
mod tests {
    use super::join_glob_text;

    #[test]
    fn puts_a_slash_between_folder_and_name() {
        // Arrange
        let folder = b"src";

        // Act
        let result = join_glob_text(folder, b"a.js");

        // Assert
        assert_eq!(result, b"src/a.js");
    }

    #[test]
    fn uses_the_name_alone_in_the_working_folder() {
        // Arrange
        let folder = b"";

        // Act
        let result = join_glob_text(folder, b"a.js");

        // Assert
        assert_eq!(result, b"a.js");
    }

    #[test]
    fn adds_no_second_slash_after_the_root() {
        // Arrange
        let folder = b"/";

        // Act
        let result = join_glob_text(folder, b"a.js");

        // Assert
        assert_eq!(result, b"/a.js");
    }
}
