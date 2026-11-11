use crate::byte_at::byte_at;
use crate::types::StarRun;

/// Read a run of `*` in a glob pattern and work out how it matches.
///
/// Without `pathname`, any run matches across `/`. With it, only a `**` that
/// makes up a whole folder name does: one that starts the pattern or follows
/// a `/`, and ends the pattern or comes before a `/` (or an escaped `/`).
/// Any other run, including a single `*`, stays within one folder name.
///
/// Whether the run starts the pattern is judged from `start`, the point the
/// current match attempt began, as git's `dowild` does.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `after_star` - The index just after the run's first `*`.
/// * `start` - The index where the current match attempt began.
/// * `pathname` - Whether `/` separates folders.
///
/// # Returns
///
/// Where the run ends and how it matches.
#[must_use]
pub(crate) fn read_star_run(
    pattern: &[u8],
    after_star: usize,
    start: usize,
    pathname: bool,
) -> StarRun {
    let mut next = after_star;
    while byte_at(pattern, next) == b'*' {
        next += 1;
    }
    let is_double_star = next > after_star;
    let starts_folder = after_star - start < 2 || pattern[after_star - 2] == b'/';
    let after_run = byte_at(pattern, next);
    let ends_folder =
        matches!(after_run, 0 | b'/') || (after_run == b'\\' && byte_at(pattern, next + 1) == b'/');
    let whole_folder = pathname && is_double_star && starts_folder && ends_folder;
    StarRun {
        next,
        match_slash: !pathname || whole_folder,
        whole_folder,
    }
}

#[cfg(test)]
mod tests {
    use super::read_star_run;
    use crate::types::StarRun;

    #[test]
    fn keeps_a_single_star_within_a_folder_name_with_folders() {
        // Arrange
        let pattern = b"*a";

        // Act
        let result = read_star_run(pattern, 1, 0, true);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 1,
                match_slash: false,
                whole_folder: false
            }
        );
    }

    #[test]
    fn lets_a_single_star_cross_slashes_without_folders() {
        // Arrange
        let pattern = b"*a";

        // Act
        let result = read_star_run(pattern, 1, 0, false);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 1,
                match_slash: true,
                whole_folder: false
            }
        );
    }

    #[test]
    fn lets_a_double_star_cross_slashes_without_folders() {
        // Arrange
        let pattern = b"a**b";

        // Act
        let result = read_star_run(pattern, 2, 0, false);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 3,
                match_slash: true,
                whole_folder: false
            }
        );
    }

    #[test]
    fn treats_a_double_star_starting_the_pattern_before_a_slash_as_a_whole_folder() {
        // Arrange
        let pattern = b"**/a";

        // Act
        let result = read_star_run(pattern, 1, 0, true);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 2,
                match_slash: true,
                whole_folder: true
            }
        );
    }

    #[test]
    fn treats_a_double_star_between_slashes_as_a_whole_folder() {
        // Arrange
        let pattern = b"a/**/b";

        // Act
        let result = read_star_run(pattern, 3, 0, true);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 4,
                match_slash: true,
                whole_folder: true
            }
        );
    }

    #[test]
    fn treats_a_trailing_double_star_after_a_slash_as_a_whole_folder() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = read_star_run(pattern, 3, 0, true);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 4,
                match_slash: true,
                whole_folder: true
            }
        );
    }

    #[test]
    fn treats_a_double_star_before_an_escaped_slash_as_a_whole_folder() {
        // Arrange
        let pattern = b"**\\/a";

        // Act
        let result = read_star_run(pattern, 1, 0, true);

        // Assert
        assert!(result.whole_folder);
    }

    #[test]
    fn keeps_a_double_star_inside_a_folder_name_within_it() {
        // Arrange
        let pattern = b"a**/b";

        // Act
        let result = read_star_run(pattern, 2, 0, true);

        // Assert
        assert_eq!(
            result,
            StarRun {
                next: 3,
                match_slash: false,
                whole_folder: false
            }
        );
    }

    #[test]
    fn keeps_a_double_star_followed_by_more_of_the_name_within_it() {
        // Arrange
        let pattern = b"**a";

        // Act
        let result = read_star_run(pattern, 1, 0, true);

        // Assert
        assert!(!result.match_slash);
    }

    #[test]
    fn judges_the_start_of_the_pattern_from_where_the_attempt_began() {
        // Arrange
        let pattern = b"a**/b";

        // Act
        let result = read_star_run(pattern, 2, 1, true);

        // Assert
        assert!(result.whole_folder);
    }

    #[test]
    fn reads_past_every_star_in_the_run() {
        // Arrange
        let pattern = b"****a";

        // Act
        let result = read_star_run(pattern, 1, 0, true);

        // Assert
        assert_eq!(result.next, 4);
    }
}
