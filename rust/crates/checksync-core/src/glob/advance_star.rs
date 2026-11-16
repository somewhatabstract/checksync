use super::decode_glob_char::decode_glob_char;
use super::in_dot_segment::in_dot_segment;
use super::starts_hidden_name::starts_hidden_name;
use super::types::HiddenNames;

/// Move the reachable text positions past a `*`, in place.
///
/// Every reachable position stays reachable, and so does every later one,
/// provided the bytes in between include no `/` when `crosses_slash` isn't
/// set. With `HiddenNames::SkipDotNames`, the `*` can't start at a `.` that
/// starts a name, not even to match nothing, and can't run over one. With
/// either `HiddenNames::SkipDotSegments` or `HiddenNames::SkipDotNames`, it
/// can't start at or run over any `.` of a name that is `.` or `..`. When `unicode`
/// is set, the `*` only stops between whole characters, as
/// `decode_glob_char` reads them.
///
/// # Arguments
///
/// * `text` - The text being matched.
/// * `positions` - For each position in the text, from 0 to its length,
///   whether matching can reach it. Updated to the positions reachable
///   after the `*`.
/// * `crosses_slash` - Whether the `*` may match `/`.
/// * `hidden` - Which hidden names are out of the `*`'s reach.
/// * `unicode` - Whether the text is read as characters rather than bytes.
///
/// # Returns
///
/// `true` if any position is reachable after the `*`.
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
    // Where the character being run over ends; every byte ends one without
    // `unicode`.
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

#[cfg(test)]
mod tests {
    use super::super::types::HiddenNames;
    use super::advance_star;

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
    fn reports_a_reachable_position() {
        // Arrange
        let mut positions = [false, true];

        // Act
        let result = advance_star(b"a", &mut positions, false, HiddenNames::MatchAll, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn reports_when_no_position_is_reachable() {
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
}
