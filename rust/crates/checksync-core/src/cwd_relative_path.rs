use std::io;
use std::path::{Path, PathBuf};

use crate::node_relative::node_relative;

/// Make a path relative to the current working folder.
///
/// This is Node.js's `path.relative(process.cwd(), file_path)`, which
/// checksync uses to show paths in its messages.
///
/// # Arguments
///
/// * `file_path` - The path to show.
///
/// # Returns
///
/// The path relative to the current working folder.
///
/// # Errors
///
/// Any error reading the current working folder.
pub fn cwd_relative_path(file_path: &Path) -> io::Result<PathBuf> {
    let cwd = std::env::current_dir()?;
    Ok(node_relative(&cwd, &cwd, file_path))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::cwd_relative_path;

    #[test]
    fn makes_a_path_below_the_working_folder_relative() {
        // Arrange
        let file = std::env::current_dir().unwrap().join("a").join("b.js");

        // Act
        let result = cwd_relative_path(&file).unwrap();

        // Assert
        assert_eq!(result, Path::new("a").join("b.js"));
    }
}
