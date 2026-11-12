use super::types::{GlobOptions, GlobToken};

/// Read a run of `*` from a glob pattern and work out what it matches.
///
/// Without `pathname`, any run matches any bytes. With it, a run of two or
/// more that starts the pattern or follows a `/` (escaped or not) can be
/// special, depending on what comes after it:
///
/// * a `/`: the run takes that `/` with it and matches any number of whole
///   folders;
/// * the end of the pattern, or an escaped `/`: the run matches any bytes,
///   and an escaped `/` is left to match a `/` of its own;
/// * anything else: the run acts like a single `*`.
///
/// Any other run acts like a single `*`, which doesn't match `/`.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `index` - Where the first `*` of the run is in the pattern.
/// * `options` - How to treat slashes.
///
/// # Returns
///
/// The token the run stands for and the index just past what it used up.
#[must_use]
pub(super) fn read_star_run(
    pattern: &[u8],
    index: usize,
    options: GlobOptions,
) -> (GlobToken, usize) {
    let length = pattern[index..]
        .iter()
        .take_while(|&&byte| byte == b'*')
        .count();
    let end = index + length;
    let rest = &pattern[end..];
    let starts_folder = index == 0 || pattern[index - 1] == b'/';
    let can_be_special = options.pathname && length >= 2 && starts_folder;
    if can_be_special && rest.first() == Some(&b'/') {
        return (GlobToken::AnyFolders, end + 1);
    }
    let crosses_slash =
        !options.pathname || (can_be_special && (rest.is_empty() || rest.starts_with(b"\\/")));
    (GlobToken::Star { crosses_slash }, end)
}

#[cfg(test)]
mod tests {
    use super::super::types::{GlobOptions, GlobToken};
    use super::read_star_run;

    const PLAIN: GlobOptions = GlobOptions {
        pathname: false,
        casefold: false,
        dot: true,
    };

    const PATHNAME: GlobOptions = GlobOptions {
        pathname: true,
        casefold: false,
        dot: true,
    };

    const CROSSING: GlobToken = GlobToken::Star {
        crosses_slash: true,
    };

    const IN_FOLDER: GlobToken = GlobToken::Star {
        crosses_slash: false,
    };

    #[test]
    fn crosses_slashes_without_pathname_mode() {
        // Arrange
        let pattern = b"a*b";

        // Act
        let result = read_star_run(pattern, 1, PLAIN);

        // Assert
        assert_eq!(result, (CROSSING, 2));
    }

    #[test]
    fn reads_the_whole_run() {
        // Arrange
        let pattern = b"a***b";

        // Act
        let result = read_star_run(pattern, 1, PLAIN);

        // Assert
        assert_eq!(result, (CROSSING, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_single_star_in_pathname_mode() {
        // Arrange
        let pattern = b"a/*";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }

    #[test]
    fn crosses_slashes_for_a_double_star_ending_the_pattern_after_a_slash() {
        // Arrange
        let pattern = b"a/**";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (CROSSING, 4));
    }

    #[test]
    fn crosses_slashes_for_a_double_star_that_is_the_whole_pattern() {
        // Arrange
        let pattern = b"**";

        // Act
        let result = read_star_run(pattern, 0, PATHNAME);

        // Assert
        assert_eq!(result, (CROSSING, 2));
    }

    #[test]
    fn matches_folders_for_a_double_star_starting_the_pattern_before_a_slash() {
        // Arrange
        let pattern = b"**/x";

        // Act
        let result = read_star_run(pattern, 0, PATHNAME);

        // Assert
        assert_eq!(result, (GlobToken::AnyFolders, 3));
    }

    #[test]
    fn matches_folders_for_a_double_star_between_slashes() {
        // Arrange
        let pattern = b"a/***/b";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (GlobToken::AnyFolders, 6));
    }

    #[test]
    fn crosses_slashes_for_a_double_star_before_an_escaped_slash() {
        // Arrange
        let pattern = b"a/**\\/b";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (CROSSING, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_before_another_escaped_byte() {
        // Arrange
        let pattern = b"a/**\\b";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (IN_FOLDER, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_after_other_bytes() {
        // Arrange
        let pattern = b"a**/b";

        // Act
        let result = read_star_run(pattern, 1, PATHNAME);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_ending_the_pattern_after_other_bytes() {
        // Arrange
        let pattern = b"a**";

        // Act
        let result = read_star_run(pattern, 1, PATHNAME);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }

    #[test]
    fn stays_in_one_folder_for_a_double_star_before_other_bytes() {
        // Arrange
        let pattern = b"a/**b";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (IN_FOLDER, 4));
    }

    #[test]
    fn stays_in_one_folder_for_a_single_star_between_slashes() {
        // Arrange
        let pattern = b"a/*/b";

        // Act
        let result = read_star_run(pattern, 2, PATHNAME);

        // Assert
        assert_eq!(result, (IN_FOLDER, 3));
    }
}
