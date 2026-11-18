//! Which hidden names wildcards may match, and finding hidden names in a text.

/// Which names starting with `.` a glob's wildcards may match.
///
/// A literal `.` in the pattern always matches, so `.git/**` and `../*` still
/// match names starting with `.`, whichever is chosen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HiddenNames {
    /// Wildcards match every name, as in git.
    MatchAll,
    /// Wildcards match names starting with `.`, but not `.` or `..`.
    ///
    /// As in fast-glob with `dot: true`, a `*` or `**` can't run over any part of a
    /// name that is exactly `.` or `..`, or start at one. `?` and bracket sets still
    /// match a `.`.
    SkipDotSegments,
    /// Wildcards match no name starting with `.`, as in fast-glob's default.
    ///
    /// A name starting with `.` can only be matched by a pattern name starting with a
    /// literal `.` or a bracket set that isn't negated: `?`, `*`, `**` and negated
    /// sets don't match its `.`, and a `*` can't even match nothing in front of it.
    /// As with [`SkipDotSegments`](Self::SkipDotSegments), a `*` or `**` can't touch a
    /// name that is exactly `.` or `..`.
    SkipDotNames,
}

/// Checks whether a position in a text is a `.` that starts a name.
///
/// A name starts at the beginning of the text or just after a `/`. `position` may
/// be the text's length, which never starts a name.
#[must_use]
pub(super) fn starts_hidden_name(text: &[u8], position: usize) -> bool {
    text.get(position) == Some(&b'.') && (position == 0 || text[position - 1] == b'/')
}

/// Checks whether a position in a text is inside a name that is `.` or `..`.
///
/// It is when the byte at `position` is a `.` of a name that is exactly `.` or
/// `..`. A name starts at the beginning of the text or just after a `/`, and ends
/// at the next `/` or the end of the text. `position` may be the text's length,
/// which is never inside a name.
#[must_use]
pub(super) fn in_dot_segment(text: &[u8], position: usize) -> bool {
    if text.get(position) != Some(&b'.') {
        return false;
    }
    let start = if position > 0 && text[position - 1] == b'.' {
        position - 1
    } else {
        position
    };
    let starts_name = start == 0 || text[start - 1] == b'/';
    // The index just past the dots: 2 past the start for `..`, 1 for `.`. The
    // name is a dot name only if a `/` or the end of the text comes there.
    let end = if text.get(start + 1) == Some(&b'.') {
        start + 2
    } else {
        start + 1
    };
    starts_name && matches!(text.get(end), None | Some(b'/'))
}

#[cfg(test)]
mod tests {
    use super::{in_dot_segment, starts_hidden_name};

    #[test]
    fn finds_a_dot_at_the_start_of_the_text() {
        // Arrange
        let text = b".a";

        // Act
        let result = starts_hidden_name(text, 0);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_a_dot_after_a_slash() {
        // Arrange
        let text = b"a/.b";

        // Act
        let result = starts_hidden_name(text, 2);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_dot_inside_a_name() {
        // Arrange
        let text = b"a.b";

        // Act
        let result = starts_hidden_name(text, 1);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_another_byte_starting_a_name() {
        // Arrange
        let text = b"a/b";

        // Act
        let result = starts_hidden_name(text, 2);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_start_a_hidden_name_at_the_end_of_the_text() {
        // Arrange
        let text = b"a/";

        // Act
        let result = starts_hidden_name(text, 2);

        // Assert
        assert!(!result);
    }

    #[test]
    fn finds_a_dot_name() {
        // Arrange
        let text = b"a/./b";

        // Act
        let result = in_dot_segment(text, 2);

        // Assert
        assert!(result);
    }

    #[test]
    fn finds_both_dots_of_a_dot_dot_name() {
        // Arrange
        let text = b"../a";

        // Act
        let result = (in_dot_segment(text, 0), in_dot_segment(text, 1));

        // Assert
        assert_eq!(result, (true, true));
    }

    #[test]
    fn finds_a_dot_dot_name_at_the_end() {
        // Arrange
        let text = b"a/..";

        // Act
        let result = in_dot_segment(text, 3);

        // Assert
        assert!(result);
    }

    #[test]
    fn ignores_a_hidden_name() {
        // Arrange
        let text = b".a";

        // Act
        let result = in_dot_segment(text, 0);

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_three_dots() {
        // Arrange
        let text = b"...";

        // Act
        let result = (
            in_dot_segment(text, 0),
            in_dot_segment(text, 1),
            in_dot_segment(text, 2),
        );

        // Assert
        assert_eq!(result, (false, false, false));
    }

    #[test]
    fn ignores_dots_ending_a_name() {
        // Arrange
        let text = b"a..";

        // Act
        let result = (in_dot_segment(text, 1), in_dot_segment(text, 2));

        // Assert
        assert_eq!(result, (false, false));
    }

    #[test]
    fn ignores_another_byte() {
        // Arrange
        let text = b"a";

        // Act
        let result = in_dot_segment(text, 0);

        // Assert
        assert!(!result);
    }

    #[test]
    fn does_not_find_a_dot_segment_at_the_end_of_the_text() {
        // Arrange
        let text = b"..";

        // Act
        let result = in_dot_segment(text, 2);

        // Assert
        assert!(!result);
    }
}
