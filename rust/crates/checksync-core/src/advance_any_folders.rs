/// Find where in the text matching moves to after a `**/` that matches
/// whole folders.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `reachable` - For each position in the text, from 0 to its length,
///   whether matching can have reached it before the `**/`.
///
/// # Returns
///
/// For each position in the text, whether matching can reach it after the
/// `**/`: any reachable position, where it matches no folders, or any later
/// position just past a `/`.
#[must_use]
pub(crate) fn advance_any_folders(text: &[u8], reachable: &[bool]) -> Vec<bool> {
    let mut next = Vec::with_capacity(reachable.len());
    let mut started = reachable[0];
    next.push(started);
    for (&byte, &here) in text.iter().zip(&reachable[1..]) {
        next.push(here || (started && byte == b'/'));
        started = started || here;
    }
    next
}

#[cfg(test)]
mod tests {
    use super::advance_any_folders;

    #[test]
    fn keeps_each_reachable_position() {
        // Arrange
        let reachable = [false, true, false, false];

        // Act
        let result = advance_any_folders(b"abc", &reachable);

        // Assert
        assert_eq!(result, vec![false, true, false, false]);
    }

    #[test]
    fn reaches_each_later_position_just_past_a_slash() {
        // Arrange
        let reachable = [true, false, false, false, false, false];

        // Act
        let result = advance_any_folders(b"a/b//", &reachable);

        // Assert
        assert_eq!(result, vec![true, false, true, false, true, true]);
    }

    #[test]
    fn does_not_reach_a_slash_before_the_first_reachable_position() {
        // Arrange
        let reachable = [false, false, true, false];

        // Act
        let result = advance_any_folders(b"a/b", &reachable);

        // Assert
        assert_eq!(result, vec![false, false, true, false]);
    }
}
