//! Helpers that match how JavaScript handles whitespace and object keys.

use indexmap::IndexMap;

/// The characters [`is_js_whitespace`] accepts, for a regex character class.
///
/// They're written for use inside a class such as `[...]` or `[^...]`.
/// Written out because the `regex` crate's Unicode `\s` is Rust's whitespace,
/// not JavaScript's.
pub(crate) const JS_WHITESPACE_CLASS: &str =
    r"\t\n\x0B\x0C\r \xA0\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";

/// Checks whether a character is whitespace the way JavaScript defines it.
///
/// This is what `\s` matches in a JavaScript regular expression, with or
/// without the `u` flag, and what `String.prototype.trim()` removes: the
/// ECMAScript `WhiteSpace` and `LineTerminator` characters. It differs from
/// Rust's [`char::is_whitespace`] in two places: it includes U+FEFF, the byte
/// order mark, and leaves out U+0085, NEL.
#[must_use]
pub fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{B}' | '\u{C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// Removes leading and trailing whitespace the way JavaScript's `trim()` does.
///
/// Unlike [`str::trim`], this removes a byte order mark (U+FEFF) and keeps
/// NEL (U+0085). See [`is_js_whitespace`].
#[must_use]
pub fn js_trim(text: &str) -> &str {
    text.trim_matches(is_js_whitespace)
}

/// Lists a map's keys in the order a JavaScript object would list them.
///
/// A JavaScript object lists keys that are array indices (`"0"`, `"7"`,
/// `"42"`, but not `"07"` or `"-1"`) first, in numeric order, and every other
/// key after them, in the order it was added. An [`IndexMap`] keeps only the
/// order keys were added, so code that has to report things in the same order
/// as checksync's JavaScript implementation sorts its keys with this.
pub(crate) fn js_object_keys<V>(map: &IndexMap<String, V>) -> Vec<&str> {
    let mut indices: Vec<(u32, &str)> = Vec::new();
    let mut others: Vec<&str> = Vec::new();
    for key in map.keys() {
        match array_index(key) {
            Some(index) => indices.push((index, key)),
            None => others.push(key),
        }
    }
    indices.sort_unstable_by_key(|&(index, _)| index);
    indices
        .into_iter()
        .map(|(_, key)| key)
        .chain(others)
        .collect()
}

/// Parses a key as a JavaScript array index.
///
/// An array index is a whole number from 0 to 2^32 - 2, written without a
/// sign or leading zeros.
fn array_index(key: &str) -> Option<u32> {
    let canonical = key == "0" || (!key.starts_with('0') && !key.is_empty());
    if !canonical || !key.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    key.parse::<u32>().ok().filter(|&index| index != u32::MAX)
}

#[cfg(test)]
mod tests {
    use indexmap::IndexMap;
    use regex::Regex;

    use super::{JS_WHITESPACE_CLASS, is_js_whitespace, js_object_keys, js_trim};

    #[test]
    fn accepts_ascii_whitespace() {
        // Arrange
        let chars = ['\t', '\n', '\u{B}', '\u{C}', '\r', ' '];

        // Act
        let result = chars.iter().all(|&c| is_js_whitespace(c));

        // Assert
        assert!(result);
    }

    #[test]
    fn accepts_the_byte_order_mark() {
        // Arrange
        let c = '\u{FEFF}';

        // Act
        let result = is_js_whitespace(c);

        // Assert
        assert!(result);
    }

    #[test]
    fn accepts_unicode_space_separators() {
        // Arrange
        let chars = [
            '\u{A0}', '\u{1680}', '\u{2000}', '\u{2005}', '\u{200A}', '\u{202F}', '\u{205F}',
            '\u{3000}',
        ];

        // Act
        let result = chars.iter().all(|&c| is_js_whitespace(c));

        // Assert
        assert!(result);
    }

    #[test]
    fn accepts_unicode_line_and_paragraph_separators() {
        // Arrange
        let chars = ['\u{2028}', '\u{2029}'];

        // Act
        let result = chars.iter().all(|&c| is_js_whitespace(c));

        // Assert
        assert!(result);
    }

    #[test]
    fn rejects_nel() {
        // Arrange
        let c = '\u{85}';

        // Act
        let result = is_js_whitespace(c);

        // Assert
        assert!(!result);
    }

    #[test]
    fn rejects_characters_that_are_no_longer_or_never_were_spaces() {
        // Arrange
        // U+180E was a space separator before Unicode 6.3, and U+200B is a
        // zero-width space, which isn't a space separator.
        let chars = ['\u{180E}', '\u{200B}', 'a', '\0'];

        // Act
        let result = chars.iter().any(|&c| is_js_whitespace(c));

        // Assert
        assert!(!result);
    }

    #[test]
    fn accepts_exactly_the_25_javascript_whitespace_characters() {
        // Arrange
        let all = (0..=u32::from(char::MAX)).filter_map(char::from_u32);

        // Act
        let count = all.filter(|&c| is_js_whitespace(c)).count();

        // Assert
        assert_eq!(count, 25);
    }

    #[test]
    fn regex_class_matches_the_same_characters() {
        // Arrange
        let class = Regex::new(&format!("^[{JS_WHITESPACE_CLASS}]$")).unwrap();
        let all = (0..=u32::from(char::MAX)).filter_map(char::from_u32);

        // Act
        let mismatches: Vec<char> = all
            .filter(|&c| class.is_match(c.encode_utf8(&mut [0; 4])) != is_js_whitespace(c))
            .collect();

        // Assert
        assert_eq!(mismatches, Vec::<char>::new());
    }

    #[test]
    fn removes_ascii_whitespace_from_both_ends() {
        // Arrange
        let text = " \t a b \r\n";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "a b");
    }

    #[test]
    fn removes_a_leading_byte_order_mark() {
        // Arrange
        let text = "\u{FEFF}// sync-start:x a.js";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "// sync-start:x a.js");
    }

    #[test]
    fn removes_unicode_spaces_and_line_separators() {
        // Arrange
        let text = "\u{A0}\u{3000}a\u{2028}\u{2029}";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "a");
    }

    #[test]
    fn keeps_nel() {
        // Arrange
        let text = "\u{85}a\u{85}";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "\u{85}a\u{85}");
    }

    #[test]
    fn keeps_whitespace_inside_the_text() {
        // Arrange
        let text = " a \u{FEFF} b ";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "a \u{FEFF} b");
    }

    #[test]
    fn trims_whitespace_only_text_to_empty() {
        // Arrange
        let text = " \u{FEFF}\t";

        // Act
        let result = js_trim(text);

        // Assert
        assert_eq!(result, "");
    }

    /// Builds a map with the given keys, added in order.
    fn map_of(keys: &[&str]) -> IndexMap<String, ()> {
        keys.iter().map(|&key| (key.to_owned(), ())).collect()
    }

    #[test]
    fn keeps_insertion_order_for_ordinary_keys() {
        // Arrange
        let map = map_of(&["b", "a", "c"]);

        // Act
        let result = js_object_keys(&map);

        // Assert
        assert_eq!(result, ["b", "a", "c"]);
    }

    #[test]
    fn lists_array_indices_first_in_numeric_order() {
        // Arrange
        let map = map_of(&["b", "10", "a", "2", "0"]);

        // Act
        let result = js_object_keys(&map);

        // Assert
        assert_eq!(result, ["0", "2", "10", "b", "a"]);
    }

    #[test]
    fn treats_numbers_with_leading_zeros_or_signs_as_ordinary_keys() {
        // Arrange
        let map = map_of(&["b", "07", "-1", "+3", "1.5", ""]);

        // Act
        let result = js_object_keys(&map);

        // Assert
        assert_eq!(result, ["b", "07", "-1", "+3", "1.5", ""]);
    }

    #[test]
    fn treats_numbers_too_large_to_be_array_indices_as_ordinary_keys() {
        // Arrange
        // 2^32 - 2 is the largest array index; 2^32 - 1 and 2^32 aren't.
        let map = map_of(&["4294967296", "4294967295", "4294967294"]);

        // Act
        let result = js_object_keys(&map);

        // Assert
        assert_eq!(result, ["4294967294", "4294967296", "4294967295"]);
    }
}
