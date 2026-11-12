use std::path::{Path, PathBuf};

/// Sort paths as JavaScript sorts strings, and drop duplicates.
///
/// JavaScript compares strings by UTF-16 code unit, which orders some text
/// differently from comparing bytes or characters. Each path is compared as
/// text with `/` between names, which is how checksync's JavaScript
/// implementation sorts the paths fast-glob gives it.
///
/// # Arguments
///
/// * `paths` - The paths to sort.
pub(super) fn sort_paths_like_javascript(paths: &mut Vec<PathBuf>) {
    paths.sort_by_cached_key(|path| utf16_key(path));
    paths.dedup();
}

/// Get a path's text, with `/` between names, as UTF-16 code units.
fn utf16_key(path: &Path) -> Vec<u16> {
    let text = path.to_string_lossy();
    #[cfg(not(unix))]
    let text = text.replace('\\', "/");
    text.encode_utf16().collect()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::sort_paths_like_javascript;

    fn paths(values: &[&str]) -> Vec<PathBuf> {
        values.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn sorts_capital_letters_before_lowercase() {
        // Arrange
        let mut sorted = paths(&["/r/a.js", "/r/B.js"]);

        // Act
        sort_paths_like_javascript(&mut sorted);

        // Assert
        assert_eq!(sorted, paths(&["/r/B.js", "/r/a.js"]));
    }

    #[test]
    fn sorts_by_utf16_code_unit_rather_than_character() {
        // Arrange
        // U+FF5E is one UTF-16 unit, 0xFF5E; U+1F600 is two, starting 0xD83D,
        // so JavaScript puts the emoji first, unlike character order.
        let mut sorted = paths(&["/r/\u{ff5e}", "/r/\u{1f600}"]);

        // Act
        sort_paths_like_javascript(&mut sorted);

        // Assert
        assert_eq!(sorted, paths(&["/r/\u{1f600}", "/r/\u{ff5e}"]));
    }

    #[test]
    fn drops_duplicates() {
        // Arrange
        let mut sorted = paths(&["/r/a.js", "/r/b.js", "/r/a.js"]);

        // Act
        sort_paths_like_javascript(&mut sorted);

        // Assert
        assert_eq!(sorted, paths(&["/r/a.js", "/r/b.js"]));
    }
}
