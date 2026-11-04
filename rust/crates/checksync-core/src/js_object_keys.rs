use indexmap::IndexMap;

/// List a map's keys in the order a JavaScript object would list them.
///
/// A JavaScript object lists keys that are array indices (`"0"`, `"7"`,
/// `"42"`, but not `"07"` or `"-1"`) first, in numeric order, and every other
/// key after them, in the order it was added. An [`IndexMap`] keeps only the
/// order keys were added, so code that has to report things in the same order
/// as checksync's JavaScript implementation sorts its keys with this.
///
/// # Arguments
///
/// * `map` - The map whose keys to list.
///
/// # Returns
///
/// The keys, in JavaScript's order.
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

/// Parse a key as a JavaScript array index: a whole number from 0 to
/// 2^32 - 2, written without a sign or leading zeros.
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

    use super::js_object_keys;

    /// Build a map with the given keys, added in order.
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
