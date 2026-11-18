//! Moving the reachable text positions past `*` and whole-folder `**/` tokens.

use super::super::hidden_names::{HiddenNames, in_dot_segment, starts_hidden_name};
use super::super::units::decode_glob_char;

/// Moves the reachable text positions past a `*`, in place.
///
/// `positions` holds, for each position in `text` from 0 to its length, whether
/// matching can reach it. Every reachable position stays reachable, and so does
/// every later one, provided the bytes in between include no `/` when
/// `crosses_slash` isn't set. With [`HiddenNames::SkipDotNames`], the `*` can't
/// start at a `.` that starts a name, not even to match nothing, and can't run
/// over one. With either [`HiddenNames::SkipDotSegments`] or
/// [`HiddenNames::SkipDotNames`], it can't start at or run over any `.` of a name
/// that is `.` or `..`. When `unicode` is set, the `*` only stops between whole
/// characters, as [`decode_glob_char`] reads them.
///
/// Returns whether any position is reachable afterwards.
#[must_use]
pub(super) fn advance_star(
    text: &[u8],
    positions: &mut [bool],
    crosses_slash: bool,
    hidden: HiddenNames,
    unicode: bool,
) -> bool {
    let blocked = |position| {
        (hidden == HiddenNames::SkipDotNames && starts_hidden_name(text, position))
            || (hidden != HiddenNames::MatchAll && in_dot_segment(text, position))
    };
    let mut carried = positions[0] && !blocked(0);
    positions[0] = carried;
    let mut any = carried;
    // The index just after the character the `*` is stepping over. With
    // `unicode`, a character can be several bytes, and the `*` may only stop
    // at the end of one; without it, every byte is a character of its own.
    let mut character_end = 0;
    for (index, slot) in positions[1..].iter_mut().enumerate() {
        if index == character_end {
            character_end += if unicode {
                decode_glob_char(text, index).1
            } else {
                1
            };
        }
        let byte = text[index];
        let continues = carried && (crosses_slash || byte != b'/') && !blocked(index);
        carried = continues || (*slot && !blocked(index + 1));
        *slot = carried && index + 1 == character_end;
        any |= *slot;
    }
    any
}

/// Moves the reachable text positions past a whole-folder `**/`, in place.
///
/// `positions` holds, for each position in `text` from 0 to its length, whether
/// matching can reach it, and is updated to the positions reachable after the
/// `**/`. Every reachable position stays reachable, where the `**/` matches no
/// folders, and so does every later position just past a `/`. With
/// [`HiddenNames::SkipDotNames`], the `**/` can't match a folder whose name starts
/// with `.`; with [`HiddenNames::SkipDotSegments`], it can't match a folder named
/// `.` or `..`.
///
/// Returns whether any position is reachable afterwards.
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
    use super::super::super::hidden_names::HiddenNames;
    use super::{advance_any_folders, advance_star};

    #[test]
    fn reaches_every_later_position() {
        // Arrange
        let mut positions = [false, true, false, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, true, HiddenNames::MatchAll, false);

        // Assert
        assert_eq!(positions, [false, true, true, true]);
    }

    #[test]
    fn stops_at_a_slash_when_it_cannot_cross_one() {
        // Arrange
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert_eq!(positions, [true, true, false, false]);
    }

    #[test]
    fn starts_again_from_a_reachable_position_after_a_slash() {
        // Arrange
        let mut positions = [true, false, true, false];

        // Act
        let _ = advance_star(b"a/b", &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert_eq!(positions, [true, true, true, true]);
    }

    #[test]
    fn does_not_start_at_a_hidden_dot_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false];

        // Act
        let _ = advance_star(
            b".a",
            &mut positions,
            false,
            HiddenNames::SkipDotNames,
            false,
        );

        // Assert
        assert_eq!(positions, [false, false, false]);
    }

    #[test]
    fn does_not_start_at_a_later_hidden_dot_when_hiding_dots() {
        // Arrange
        let mut positions = [false, false, true, false];

        // Act
        let _ = advance_star(
            b"a/.",
            &mut positions,
            false,
            HiddenNames::SkipDotNames,
            false,
        );

        // Assert
        assert_eq!(positions, [false, false, false, false]);
    }

    #[test]
    fn does_not_run_over_a_hidden_dot_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false, false, false];

        // Act
        let _ = advance_star(
            b"a/.b",
            &mut positions,
            true,
            HiddenNames::SkipDotNames,
            false,
        );

        // Assert
        assert_eq!(positions, [true, true, true, false, false]);
    }

    #[test]
    fn runs_over_a_dot_inside_a_name_when_hiding_dots() {
        // Arrange
        let mut positions = [true, false, false];

        // Act
        let _ = advance_star(
            b"a.",
            &mut positions,
            false,
            HiddenNames::SkipDotNames,
            false,
        );

        // Assert
        assert_eq!(positions, [true, true, true]);
    }

    #[test]
    fn starts_at_a_hidden_dot_when_allowing_dots() {
        // Arrange
        let mut positions = [true, false, false];

        // Act
        let _ = advance_star(b".a", &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert_eq!(positions, [true, true, true]);
    }

    #[test]
    fn reports_a_reachable_position_after_a_star() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_star(b"a", &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable_after_a_star() {
        // Arrange
        let mut positions = [false, false];

        // Act
        let result = advance_star(b"a", &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert!(!result);
    }

    #[test]
    fn stops_only_between_characters_with_unicode() {
        // Arrange
        let text = "aé".as_bytes();
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_star(text, &mut positions, false, HiddenNames::MatchAll, true);

        // Assert
        assert_eq!(positions, [true, true, false, true]);
    }

    #[test]
    fn stops_inside_characters_without_unicode() {
        // Arrange
        let text = "aé".as_bytes();
        let mut positions = [true, false, false, false];

        // Act
        let _ = advance_star(text, &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert_eq!(positions, [true, true, true, true]);
    }

    #[test]
    fn does_not_run_over_a_dot_dot_name_when_skipping_dot_segments() {
        // Arrange
        let mut positions = [true, false, false, false, false];

        // Act
        let _ = advance_star(
            b"../a",
            &mut positions,
            true,
            HiddenNames::SkipDotSegments,
            false,
        );

        // Assert
        assert_eq!(positions, [false, false, false, false, false]);
    }

    #[test]
    fn runs_over_a_hidden_name_when_skipping_dot_segments() {
        // Arrange
        let mut positions = [true, false, false, false, false];

        // Act
        let _ = advance_star(
            b".a/b",
            &mut positions,
            true,
            HiddenNames::SkipDotSegments,
            false,
        );

        // Assert
        assert_eq!(positions, [true, true, true, true, true]);
    }

    #[test]
    fn stops_before_a_dot_dot_name_when_skipping_dot_segments() {
        // Arrange
        let mut positions = [true, false, false, false, false];

        // Act
        let _ = advance_star(
            b"a/..",
            &mut positions,
            true,
            HiddenNames::SkipDotSegments,
            false,
        );

        // Assert
        assert_eq!(positions, [true, true, true, false, false]);
    }

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
    fn reports_a_reachable_position_after_any_folders() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_any_folders(b"a", &mut positions, HiddenNames::MatchAll);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable_after_any_folders() {
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
