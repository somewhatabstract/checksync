use super::starts_hidden_name::starts_hidden_name;

/// Move the reachable text positions past a `*`, in place.
///
/// Every reachable position stays reachable, and so does every later one,
/// provided the bytes in between include no `/` when `crosses_slash` isn't
/// set. When `hides_dots` is set, the `*` can't start at a `.` that starts
/// a name, not even to match nothing, and can't run over one.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the `*`.
/// * `crosses_slash` - Whether the `*` may match `/`.
/// * `hides_dots` - Whether a `.` starting a name is out of the `*`'s reach.
///
/// # Returns
///
/// `true` if any position is reachable after the `*`.
#[must_use]
pub(super) fn advance_star(
    text: &[u8],
    positions: &mut [bool],
    crosses_slash: bool,
    hides_dots: bool,
) -> bool {
    let blocked = |position| hides_dots && starts_hidden_name(text, position);
    let mut carried = positions[0] && !blocked(0);
    positions[0] = carried;
    let mut any = carried;
    for (index, slot) in positions[1..].iter_mut().enumerate() {
        let byte = text[index];
        let continues = carried && (crosses_slash || byte != b'/') && !blocked(index);
        carried = continues || (*slot && !blocked(index + 1));
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
        let _ = advance_star(b"a/b", &mut positions, true, false);

        // Assert
        assert_eq!(positions, [false, true, true, true]);
    }

    #[test]
    fn stops_at_a_slash_when_it_cannot_cross_one() {
        // Arrange
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, false, false);

        // Assert
        assert_eq!(positions, [true, true, false, false]);
    }

    #[test]
    fn starts_again_from_a_reachable_position_after_a_slash() {
        // Arrange
        let mut positions = [true, false, true, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, false, false);

        // Assert
        assert_eq!(positions, [true, true, true, true]);
    }

    #[test]
    fn does_not_start_at_a_hidden_dot_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false];

        // Act
        let _ = advance_star(b".a", &mut positions, false, true);

        // Assert
        assert_eq!(positions, [false, false, false]);
    }

    #[test]
    fn does_not_start_at_a_later_hidden_dot_when_hiding_dots() {
        // Arrange
        let mut positions = [false, false, true, false];

        // Act
        let _ = advance_star(b"a/.", &mut positions, false, true);

        // Assert
        assert_eq!(positions, [false, false, false, false]);
    }

    #[test]
    fn does_not_run_over_a_hidden_dot_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false, false, false];

        // Act
        let _ = advance_star(b"a/.b", &mut positions, true, true);

        // Assert
        assert_eq!(positions, [true, true, true, false, false]);
    }

    #[test]
    fn runs_over_a_dot_inside_a_name_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false];

        // Act
        let _ = advance_star(b"a.", &mut positions, false, true);

        // Assert
        assert_eq!(positions, [true, true, true]);
    }

    #[test]
    fn starts_at_a_hidden_dot_when_allowing_dots() {
        // Arrange
        let mut positions = [true, false, false];

        // Act
        let _ = advance_star(b".a", &mut positions, false, false);

        // Assert
        assert_eq!(positions, [true, true, true]);
    }

    #[test]
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_star(b"a", &mut positions, false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable() {
        // Arrange
        let mut positions = [false, false];

        // Act
        let result = advance_star(b"a", &mut positions, false, false);

        // Assert
        assert!(!result);
    }
}
