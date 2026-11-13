use std::path::{Path, PathBuf};

use crate::node_normalize::node_normalize;

use super::glob_text::glob_text;

/// Turn a path's glob text into the glob text of its absolute path.
///
/// The text is resolved against the working folder the way Node.js's
/// `path.resolve` does, so `.` and `..` names are worked out and an absolute
/// text stays as it is. As in fast-glob, absolute exclude patterns are
/// matched against this form of a path.
///
/// # Arguments
///
/// * `cwd` - The absolute working folder.
/// * `text` - The path's text, relative to the working folder or absolute,
///   with `/` between names.
///
/// # Returns
///
/// The absolute path's text, with `/` between names.
#[must_use]
pub(super) fn absolute_glob_text(cwd: &Path, text: &[u8]) -> Vec<u8> {
    let path = node_normalize(&cwd.join(text_path(text)));
    let absolute = glob_text(path.as_os_str()).into_owned();
    #[cfg(windows)]
    let absolute = absolute
        .into_iter()
        .map(|byte| if byte == b'\\' { b'/' } else { byte })
        .collect();
    absolute
}

/// Turn glob text back into a path.
fn text_path(text: &[u8]) -> PathBuf {
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        std::ffi::OsStr::from_bytes(text).into()
    }
    #[cfg(not(unix))]
    {
        String::from_utf8_lossy(text).into_owned().into()
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::path::Path;

    use super::absolute_glob_text;

    #[test]
    fn joins_a_relative_text_to_the_working_folder() {
        // Arrange
        let text = b"src/a.js";

        // Act
        let result = absolute_glob_text(Path::new("/repo"), text);

        // Assert
        assert_eq!(result, b"/repo/src/a.js");
    }

    #[test]
    fn works_out_parent_folders() {
        // Arrange
        let text = b"../lib/./a.js";

        // Act
        let result = absolute_glob_text(Path::new("/repo/src"), text);

        // Assert
        assert_eq!(result, b"/repo/lib/a.js");
    }

    #[test]
    fn keeps_an_absolute_text() {
        // Arrange
        let text = b"/other/a.js";

        // Act
        let result = absolute_glob_text(Path::new("/repo"), text);

        // Assert
        assert_eq!(result, b"/other/a.js");
    }
}
