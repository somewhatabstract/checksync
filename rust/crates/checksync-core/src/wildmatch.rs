use crate::match_bracket_class::match_bracket_class;
use crate::types::BracketClassMatch;

/// How a match attempt ended, as in git's `dowild`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    Match,
    NoMatch,
    /// No later starting point can match either, so stop trying.
    Abort,
    /// A `*` reached a `/` it can't cross, so only an enclosing `**` can
    /// try a later starting point.
    AbortToDoubleStar,
}

/// Match a glob pattern against text, as git's `wildmatch` does.
///
/// `*` matches any run of characters, `?` any one, `[...]` a class of them
/// and `\` escapes the next character. With `pathname` set, `/` separates
/// folders: only `**` that makes up a whole folder name (such as `a/**/b`)
/// can match across one, and `*`, `?` and classes never match `/`. Without
/// it, `*` and `**` are the same. A NUL byte ends the pattern or text, as
/// in git.
///
/// # Arguments
///
/// * `pattern` - The glob pattern.
/// * `text` - The text to match.
/// * `pathname` - Whether `/` separates folders.
/// * `casefold` - Whether to ignore case, for ASCII letters only.
///
/// # Returns
///
/// Whether the whole text matches the pattern.
#[must_use]
pub(crate) fn wildmatch(pattern: &[u8], text: &[u8], pathname: bool, casefold: bool) -> bool {
    dowild(pattern, 0, text, 0, pathname, casefold) == Outcome::Match
}

/// The byte at `index`, or NUL past the end, so slices read like C strings.
fn at(bytes: &[u8], index: usize) -> u8 {
    bytes.get(index).copied().unwrap_or(0)
}

/// Lowercase an ASCII letter when ignoring case.
fn fold(byte: u8, casefold: bool) -> u8 {
    if casefold {
        byte.to_ascii_lowercase()
    } else {
        byte
    }
}

/// Whether the text has a `/` from `index` on, before any NUL.
fn slash_from(text: &[u8], index: usize) -> Option<usize> {
    // The text index never passes the end, since it only moves past a byte.
    text[index..]
        .iter()
        .take_while(|&&byte| byte != 0)
        .position(|&byte| byte == b'/')
        .map(|offset| index + offset)
}

/// Match `pattern` from `start` against `text` from `text_index`.
///
/// This follows git's `dowild` line for line, so the two can be compared.
#[expect(
    clippy::too_many_lines,
    reason = "a line-for-line port of git's dowild, kept whole to compare with it"
)]
fn dowild(
    pattern: &[u8],
    start: usize,
    text: &[u8],
    text_index: usize,
    pathname: bool,
    casefold: bool,
) -> Outcome {
    let mut p = start;
    let mut t = text_index;
    loop {
        let mut p_ch = at(pattern, p);
        if p_ch == 0 {
            break;
        }
        let mut t_ch = at(text, t);
        if t_ch == 0 && p_ch != b'*' {
            return Outcome::Abort;
        }
        t_ch = fold(t_ch, casefold);
        p_ch = fold(p_ch, casefold);
        match p_ch {
            b'\\' => {
                // The escaped character isn't lowercased, as in git.
                p += 1;
                if t_ch != at(pattern, p) {
                    return Outcome::NoMatch;
                }
            }
            b'?' => {
                if pathname && t_ch == b'/' {
                    return Outcome::NoMatch;
                }
            }
            b'*' => {
                p += 1;
                let match_slash;
                if at(pattern, p) == b'*' {
                    let second = p;
                    while at(pattern, p) == b'*' {
                        p += 1;
                    }
                    let starts_folder = second - start < 2 || pattern[second - 2] == b'/';
                    let ends_folder = matches!(at(pattern, p), 0 | b'/')
                        || (at(pattern, p) == b'\\' && at(pattern, p + 1) == b'/');
                    if !pathname {
                        match_slash = true;
                    } else if starts_folder && ends_folder {
                        // `a/**/b` also matches `a/b`: try the rest of the
                        // pattern with `**/` matching nothing.
                        if at(pattern, p) == b'/'
                            && dowild(pattern, p + 1, text, t, pathname, casefold) == Outcome::Match
                        {
                            return Outcome::Match;
                        }
                        match_slash = true;
                    } else {
                        match_slash = false;
                    }
                } else {
                    match_slash = !pathname;
                }
                if at(pattern, p) == 0 {
                    // A trailing `**` matches everything, and a trailing `*`
                    // everything up to the next `/`.
                    if !match_slash && slash_from(text, t).is_some() {
                        return Outcome::AbortToDoubleStar;
                    }
                    return Outcome::Match;
                }
                if !match_slash && at(pattern, p) == b'/' {
                    // A `*` followed by `/` matches the rest of this folder
                    // name; the loop then matches the `/` itself.
                    match slash_from(text, t) {
                        Some(slash) => t = slash,
                        None => return Outcome::Abort,
                    }
                } else {
                    loop {
                        if t_ch == 0 {
                            break;
                        }
                        let next = at(pattern, p);
                        if !matches!(next, b'*' | b'?' | b'[' | b'\\') {
                            // Skip ahead to the literal that follows the `*`,
                            // without crossing a `/` it can't match.
                            let wanted = fold(next, casefold);
                            loop {
                                t_ch = at(text, t);
                                if t_ch == 0 || (!match_slash && t_ch == b'/') {
                                    break;
                                }
                                t_ch = fold(t_ch, casefold);
                                if t_ch == wanted {
                                    break;
                                }
                                t += 1;
                            }
                            if t_ch != wanted {
                                return if match_slash {
                                    Outcome::Abort
                                } else {
                                    Outcome::AbortToDoubleStar
                                };
                            }
                        }
                        let matched = dowild(pattern, p, text, t, pathname, casefold);
                        if matched != Outcome::NoMatch {
                            if !match_slash || matched != Outcome::AbortToDoubleStar {
                                return matched;
                            }
                        } else if !match_slash && t_ch == b'/' {
                            return Outcome::AbortToDoubleStar;
                        }
                        t += 1;
                        t_ch = at(text, t);
                    }
                    return Outcome::Abort;
                }
            }
            b'[' => match match_bracket_class(pattern, p, t_ch, casefold, pathname) {
                BracketClassMatch::Matched { close } => p = close,
                BracketClassMatch::NoMatch => return Outcome::NoMatch,
                BracketClassMatch::Abort => return Outcome::Abort,
            },
            _ => {
                if t_ch != p_ch {
                    return Outcome::NoMatch;
                }
            }
        }
        p += 1;
        t += 1;
    }
    if at(text, t) == 0 {
        Outcome::Match
    } else {
        Outcome::NoMatch
    }
}

#[cfg(test)]
mod tests {
    use super::wildmatch;

    /// Match with `/` separating folders and case mattering.
    fn path_match(pattern: &str, text: &str) -> bool {
        wildmatch(pattern.as_bytes(), text.as_bytes(), true, false)
    }

    #[test]
    fn matches_literal_text() {
        // Arrange
        let pattern = "a.txt";

        // Act
        let result = [path_match(pattern, "a.txt"), path_match(pattern, "b.txt")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn needs_the_whole_text_to_match() {
        // Arrange
        let pattern = "a";

        // Act
        let result = [path_match(pattern, "ab"), path_match("ab", "a")];

        // Assert
        assert_eq!(result, [false, false]);
    }

    #[test]
    fn matches_any_one_character_except_a_slash_with_a_question_mark() {
        // Arrange
        let pattern = "a?c";

        // Act
        let result = [path_match(pattern, "abc"), path_match(pattern, "a/c")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_a_slash_with_a_question_mark_without_folders() {
        // Arrange
        let pattern = b"a?c";

        // Act
        let result = wildmatch(pattern, b"a/c", false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_within_one_folder_name_with_an_asterisk() {
        // Arrange
        let pattern = "a*c";

        // Act
        let result = [path_match(pattern, "abbc"), path_match(pattern, "ab/c")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_across_folders_with_an_asterisk_without_folders() {
        // Arrange
        let pattern = b"a*c";

        // Act
        let result = wildmatch(pattern, b"ab/c", false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_any_number_of_folders_with_a_whole_double_asterisk() {
        // Arrange
        let pattern = "a/**/b";

        // Act
        let result = [
            path_match(pattern, "a/b"),
            path_match(pattern, "a/x/b"),
            path_match(pattern, "a/x/y/b"),
        ];

        // Assert
        assert_eq!(result, [true, true, true]);
    }

    #[test]
    fn matches_everything_with_a_trailing_double_asterisk() {
        // Arrange
        let pattern = "a/**";

        // Act
        let result = [path_match(pattern, "a/x"), path_match(pattern, "a/x/y")];

        // Assert
        assert_eq!(result, [true, true]);
    }

    #[test]
    fn matches_up_to_a_slash_with_a_trailing_asterisk() {
        // Arrange
        let pattern = "a/*";

        // Act
        let result = [path_match(pattern, "a/x"), path_match(pattern, "a/x/y")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_one_folder_name_with_an_asterisk_before_a_slash() {
        // Arrange
        let pattern = "*/b";

        // Act
        let result = [path_match(pattern, "a/b"), path_match(pattern, "a")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn treats_a_double_asterisk_inside_a_folder_name_as_one() {
        // Arrange
        let pattern = "a**b";

        // Act
        let result = [path_match(pattern, "axxb"), path_match(pattern, "ax/b")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn treats_a_double_asterisk_starting_a_folder_name_as_one() {
        // Arrange
        let pattern = "**a";

        // Act
        let result = [path_match(pattern, "xa"), path_match(pattern, "x/a")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_across_folders_with_a_double_asterisk_without_folders() {
        // Arrange
        let pattern = b"a**b";

        // Act
        let result = wildmatch(pattern, b"ax/b", false, false);

        // Assert
        assert!(result);
    }

    #[test]
    fn ends_a_whole_double_asterisk_at_an_escaped_slash() {
        // Arrange
        let pattern = r"a/**\/b";

        // Act
        let result = path_match(pattern, "a/x/b");

        // Assert
        assert!(result);
    }

    #[test]
    fn matches_an_escaped_character_literally() {
        // Arrange
        let pattern = r"a\*";

        // Act
        let result = [path_match(pattern, "a*"), path_match(pattern, "ab")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_nothing_with_a_backslash_at_the_end() {
        // Arrange
        let pattern = "a\\";

        // Act
        let result = path_match(pattern, "a\\");

        // Assert
        assert!(!result);
    }

    #[test]
    fn ignores_ascii_case_when_asked() {
        // Arrange
        let pattern = b"A*.TXT";

        // Act
        let result = wildmatch(pattern, b"abc.txt", true, true);

        // Assert
        assert!(result);
    }

    #[test]
    fn keeps_the_case_of_an_escaped_letter() {
        // Arrange
        let pattern = br"\A";

        // Act
        let result = wildmatch(pattern, b"a", true, true);

        // Assert
        assert!(!result);
    }

    #[test]
    fn matches_a_bracket_class() {
        // Arrange
        let pattern = "[ab]c";

        // Act
        let result = [
            path_match(pattern, "bc"),
            path_match(pattern, "cc"),
            path_match("[ab", "a"),
        ];

        // Assert
        assert_eq!(result, [true, false, false]);
    }

    #[test]
    fn tries_later_starting_points_for_an_asterisk() {
        // Arrange
        let pattern = "*a?c";

        // Act
        let result = [path_match(pattern, "aaxc"), path_match(pattern, "xaxd")];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn stops_an_asterisk_at_a_slash_before_the_next_literal() {
        // Arrange
        let pattern = "a*c";

        // Act
        let result = path_match(pattern, "ab/xc");

        // Assert
        assert!(!result);
    }

    #[test]
    fn backs_out_to_a_double_asterisk_when_an_asterisk_reaches_a_slash() {
        // Arrange
        let pattern = "**/a*?";

        // Act
        let result = [
            path_match(pattern, "x/ab/y/ab"),
            path_match(pattern, "x/a/b"),
        ];

        // Assert
        assert_eq!(result, [true, false]);
    }

    #[test]
    fn matches_nothing_after_the_end_of_text_with_an_asterisk() {
        // Arrange
        let pattern = "a*?";

        // Act
        let result = path_match(pattern, "a");

        // Assert
        assert!(!result);
    }

    #[test]
    fn ends_the_pattern_at_a_nul_byte() {
        // Arrange
        let pattern = b"a\0b";

        // Act
        let result = wildmatch(pattern, b"a", true, false);

        // Assert
        assert!(result);
    }
}
