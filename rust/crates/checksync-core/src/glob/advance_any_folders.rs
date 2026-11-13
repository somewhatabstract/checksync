use super::in_dot_segment::in_dot_segment;
use super::starts_hidden_name::starts_hidden_name;
use super::types::HiddenNames;

/// Move the reachable text positions past a whole-folder `**/`, in place.
///
/// Every reachable position stays reachable, where the `**/` matches no
/// folders, and so does every later position just past a `/`. With
/// `HiddenNames::SkipDotNames`, the `**/` can't match a folder whose name
/// starts with `.`; with `HiddenNames::SkipDotSegments`, it can't match a
/// folder named `.` or `..`.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the `**/`.
/// * `hidden` - Which hidden folders are out of the `**/`'s reach.
///
/// # Returns
///
/// `true` if any position is reachable after the `**/`.
#[must_use]
pub(super) fn advance_any_folders(
    text: &[u8],
    positions: &mut [bool],
    hidden: HiddenNames,
) -> bool {
    let mut started = false;
    let mut any = false;
    for (position, slot) in positions.iter_mut().enumerate() {
        let here = *slot;
        let arrived = started && position > 0 && text[position - 1] == b'/';
        *slot = here || arrived;
        any |= here;
        // A folder starting with a hidden dot, or one named `.` or `..`, can't
        // be passed over when the options say so, so only a later reachable
        // position can start again.
        let blocked = (hidden == HiddenNames::SkipDotNames && starts_hidden_name(text, position))
            || (hidden != HiddenNames::MatchAll && in_dot_segment(text, position));
        started = (started || here) && !blocked;
    }
    // Every position reachable before stays reachable, so some position is
    // reachable after exactly when one was before.
    any
}

#[cfg(test)]
mod tests {
    use super::super::types::HiddenNames;
    use super::advance_any_folders;

    #[test]
    fn keeps_each_reachable_position() {
        // Arrange
        let mut positions = [false, true, false, false];

        // Act
        let _ = advance_any_folders(b"abc", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert_eq!(positions, [false, true, false, false]);
    }

    #[test]
    fn reaches_each_later_position_just_past_a_slash() {
        // Arrange
        let mut positions = [true, false, false, false, false, false];

        // Act
        let _ = advance_any_folders(b"a/b//", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert_eq!(positions, [true, false, true, false, true, true]);
    }

    #[test]
    fn does_not_reach_a_slash_before_the_first_reachable_position() {
        // Arrange
        let mut positions = [false, false, true, false];

        // Act
        let _ = advance_any_folders(b"a/b", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert_eq!(positions, [false, false, true, false]);
    }

    #[test]
    fn does_not_pass_a_hidden_folder_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false, false, false, false, false];

        // Act
        let _ = advance_any_folders(b"a/.b/c", &mut positions, HiddenNames::SkipDotNames);

        // Assert
        assert_eq!(positions, [true, false, true, false, false, false, false]);
    }

    #[test]
    fn keeps_a_reachable_hidden_folder_start_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_any_folders(b".b/", &mut positions, HiddenNames::SkipDotNames);

        // Assert
        assert_eq!(positions, [true, false, false, false]);
    }

    #[test]
    fn passes_a_hidden_folder_when_allowing_dots() {
        // Arrange
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_any_folders(b".b/", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert_eq!(positions, [true, false, false, true]);
    }

    #[test]
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_any_folders(b"a", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable() {
        // Arrange
        let mut positions = [false, false];

        // Act
        let result = advance_any_folders(b"/", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_pass_a_dot_dot_folder_when_skipping_dot_segments() {
        // Arrange
        let mut positions = [true, false, false, false, false];

        // Act
        let _ = advance_any_folders(b"../a", &mut positions, HiddenNames::SkipDotSegments);

        // Assert
        assert_eq!(positions, [true, false, false, false, false]);
    }

    #[test]
    fn passes_a_hidden_folder_when_skipping_dot_segments() {
        // Arrange
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_any_folders(b".b/", &mut positions, HiddenNames::SkipDotSegments);

        // Assert
        assert_eq!(positions, [true, false, false, true]);
    }
}
