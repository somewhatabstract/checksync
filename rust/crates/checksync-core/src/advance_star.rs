/// Find where in the text matching moves to after a `*`.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `reachable` - For each position in the text, from 0 to its length,
///   whether matching can have reached it before the `*`.
/// * `crosses_slash` - Whether the `*` may match `/`.
///
/// # Returns
///
/// For each position in the text, whether matching can reach it after the
/// `*`: any reachable position, or any later one, provided the bytes in
/// between include no `/` when `crosses_slash` isn't set.
#[must_use]
pub(crate) fn advance_star(text: &[u8], reachable: &[bool], crosses_slash: bool) -> Vec<bool> {
    let mut next = Vec::with_capacity(reachable.len());
    let mut carried = reachable[0];
    next.push(carried);
    for (&byte, &here) in text.iter().zip(&reachable[1..]) {
        carried = (carried && (crosses_slash || byte != b'/')) || here;
        next.push(carried);
    }
    next
}

#[cfg(test)]
mod tests {
    use super::advance_star;

    #[test]
    fn reaches_every_later_position() {
        // Arrange
        let reachable = [false, true, false, false];

        // Act
        let result = advance_star(b"a/b", &reachable, true);

        // Assert
        assert_eq!(result, vec![false, true, true, true]);
    }

    #[test]
    fn stops_at_a_slash_when_it_cannot_cross_one() {
        // Arrange
        let reachable = [true, false, false, false];

        // Act
        let result = advance_star(b"a/b", &reachable, false);

        // Assert
        assert_eq!(result, vec![true, true, false, false]);
    }

    #[test]
    fn starts_again_from_a_reachable_position_after_a_slash() {
        // Arrange
        let reachable = [true, false, true, false];

        // Act
        let result = advance_star(b"a/b", &reachable, false);

        // Assert
        assert_eq!(result, vec![true, true, true, true]);
    }
}
