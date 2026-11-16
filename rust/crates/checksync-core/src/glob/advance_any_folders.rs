/// Move the reachable text positions past a `**/` that matches whole
/// folders, in place.
///
/// Every reachable position stays reachable, where the `**/` matches no
/// folders, and so does every later position just past a `/`.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the `**/`.
///
/// # Returns
///
/// `true` if any position is reachable after the `**/`.
#[must_use]
pub(super) fn advance_any_folders(text: &[u8], positions: &mut [bool]) -> bool {
    let mut started = positions[0];
    for (&byte, slot) in text.iter().zip(&mut positions[1..]) {
        let here = *slot;
        *slot = here || (started && byte == b'/');
        started |= here;
    }
    // Every position reachable before stays reachable, so some position is
    // reachable after exactly when one was before.
    started
}

#[cfg(test)]
mod tests {
    use super::advance_any_folders;

    #[test]
    fn keeps_each_reachable_position() {
        // Arrange
        let mut positions = [false, true, false, false];

        // Act
        let _ = advance_any_folders(b"abc", &mut positions);

        // Assert
        assert_eq!(positions, [false, true, false, false]);
    }

    #[test]
    fn reaches_each_later_position_just_past_a_slash() {
        // Arrange
        let mut positions = [true, false, false, false, false, false];

        // Act
        let _ = advance_any_folders(b"a/b//", &mut positions);

        // Assert
        assert_eq!(positions, [true, false, true, false, true, true]);
    }

    #[test]
    fn does_not_reach_a_slash_before_the_first_reachable_position() {
        // Arrange
        let mut positions = [false, false, true, false];

        // Act
        let _ = advance_any_folders(b"a/b", &mut positions);

        // Assert
        assert_eq!(positions, [false, false, true, false]);
    }

    #[test]
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_any_folders(b"a", &mut positions);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable() {
        // Arrange
        let mut positions = [false, false];

        // Act
        let result = advance_any_folders(b"/", &mut positions);

        // Assert
        assert!(!result);
    }
}
