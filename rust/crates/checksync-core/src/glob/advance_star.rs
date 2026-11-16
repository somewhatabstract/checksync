/// Move the reachable text positions past a `*`, in place.
///
/// Every reachable position stays reachable, and so does every later one,
/// provided the bytes in between include no `/` when `crosses_slash` isn't
/// set.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the `*`.
/// * `crosses_slash` - Whether the `*` may match `/`.
///
/// # Returns
///
/// `true` if any position is reachable after the `*`.
#[must_use]
pub(super) fn advance_star(text: &[u8], positions: &mut [bool], crosses_slash: bool) -> bool {
    let mut carried = positions[0];
    let mut any = carried;
    for (&byte, slot) in text.iter().zip(&mut positions[1..]) {
        carried = (carried && (crosses_slash || byte != b'/')) || *slot;
        *slot = carried;
        any |= carried;
    }
    any
}

#[cfg(test)]
mod tests {
    use super::advance_star;

    #[test]
    fn reaches_every_later_position() {
        // Arrange
        let mut positions = [false, true, false, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, true);

        // Assert
        assert_eq!(positions, [false, true, true, true]);
    }

    #[test]
    fn stops_at_a_slash_when_it_cannot_cross_one() {
        // Arrange
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, false);

        // Assert
        assert_eq!(positions, [true, true, false, false]);
    }

    #[test]
    fn starts_again_from_a_reachable_position_after_a_slash() {
        // Arrange
        let mut positions = [true, false, true, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, false);

        // Assert
        assert_eq!(positions, [true, true, true, true]);
    }

    #[test]
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_star(b"a", &mut positions, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable() {
        // Arrange
        let mut positions = [false, false];

        // Act
        let result = advance_star(b"a", &mut positions, false);

        // Assert
        assert!(!result);
    }
}
