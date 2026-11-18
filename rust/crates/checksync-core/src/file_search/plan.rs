//! Planning a search: which folders to walk for which include patterns.

use crate::glob::{BraceExpansionError, expand_braces};

use super::GetFilesError;
use super::glob_base::glob_base;
use super::tidy_pattern::tidy_pattern;

/// An include pattern and the folder to start walking from to find its files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GlobTask {
    /// The folder to walk, relative to the working folder.
    ///
    /// It has `/` between names, and is `.` for the working folder itself.
    pub base: String,
    /// The pattern, relative to the working folder, that files must match.
    pub pattern: String,
}

/// The include tasks and exclude patterns for one search.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct GlobPlan {
    /// The include patterns, each with the folder to walk.
    pub tasks: Vec<GlobTask>,
    /// The patterns that remove files and prune folders.
    ///
    /// They're relative to the working folder.
    pub excludes: Vec<String>,
}

/// Plans a search: which folders to walk, for which patterns, excluding what.
///
/// Include patterns are relative to the working folder, and exclude patterns
/// are relative to it or absolute. Each include pattern's brace groups are
/// expanded, and each result becomes a task that walks the folder before its
/// first glob character. An include pattern starting with `!` excludes
/// instead, and an exclude pattern starting with `!` excludes all the same,
/// as in fast-glob. Every pattern has its repeated slashes collapsed and
/// leading `./`s dropped.
///
/// # Errors
///
/// Returns [`GetFilesError::PatternTooLong`] for a pattern too long to expand
/// its braces, and [`GetFilesError::TooManyPatterns`] for one whose braces
/// expand to too many patterns.
pub(super) fn plan_glob_tasks(
    includes: &[String],
    excludes: &[String],
) -> Result<GlobPlan, GetFilesError> {
    let mut plan = GlobPlan {
        tasks: Vec::new(),
        excludes: Vec::new(),
    };
    let mut exclude_sources: Vec<&str> = Vec::new();
    for include in includes {
        if let Some(negated) = include.strip_prefix('!') {
            exclude_sources.push(negated);
            continue;
        }
        for pattern in expand_pattern_braces(include)? {
            let pattern = tidy_pattern(&pattern);
            plan.tasks.push(GlobTask {
                base: glob_base(&pattern),
                pattern,
            });
        }
    }
    exclude_sources.extend(
        excludes
            .iter()
            .map(|exclude| exclude.strip_prefix('!').unwrap_or(exclude)),
    );
    for source in exclude_sources {
        for pattern in expand_pattern_braces(source)? {
            plan.excludes.push(tidy_pattern(&pattern));
        }
    }
    Ok(plan)
}

/// Expands a pattern's brace groups into the patterns they stand for.
///
/// The results keep the pattern's order, and a pattern with no groups gives
/// just itself.
///
/// # Errors
///
/// Returns [`GetFilesError::PatternTooLong`] for a pattern too long to expand
/// its braces, and [`GetFilesError::TooManyPatterns`] for one whose braces
/// expand to too many patterns.
fn expand_pattern_braces(pattern: &str) -> Result<Vec<String>, GetFilesError> {
    // Brace expansion only splits at ASCII bytes, so the results are as valid
    // as the pattern.
    expand_braces(pattern.as_bytes())
        .map(|expanded| {
            expanded
                .iter()
                .map(|bytes| String::from_utf8_lossy(bytes).into_owned())
                .collect()
        })
        .map_err(|error| match error {
            BraceExpansionError::PatternTooLong => GetFilesError::PatternTooLong {
                pattern: pattern.to_owned(),
            },
            BraceExpansionError::TooManyResults => GetFilesError::TooManyPatterns {
                pattern: pattern.to_owned(),
            },
        })
}

#[cfg(test)]
mod tests {
    use super::{GlobPlan, GlobTask, expand_pattern_braces, plan_glob_tasks};

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|&value| value.to_owned()).collect()
    }

    fn task(base: &str, pattern: &str) -> GlobTask {
        GlobTask {
            base: base.to_owned(),
            pattern: pattern.to_owned(),
        }
    }

    fn too_many_message(pattern: &str) -> String {
        format!("pattern's braces expand to too many patterns: {pattern}")
    }

    #[test]
    fn plans_a_task_for_each_include_pattern() {
        // Arrange
        let includes = strings(&["src/*.js", "**/*.ts"]);

        // Act
        let result = plan_glob_tasks(&includes, &[]).unwrap();

        // Assert
        assert_eq!(
            result,
            GlobPlan {
                tasks: vec![task("src", "src/*.js"), task(".", "**/*.ts")],
                excludes: vec![],
            }
        );
    }

    #[test]
    fn plans_a_task_for_each_brace_alternative() {
        // Arrange
        let includes = strings(&["{src,lib}/*.js"]);

        // Act
        let result = plan_glob_tasks(&includes, &[]).unwrap();

        // Assert
        assert_eq!(
            result.tasks,
            vec![task("src", "src/*.js"), task("lib", "lib/*.js")]
        );
    }

    #[test]
    fn tidies_an_include_pattern() {
        // Arrange
        let includes = strings(&[".//src//a.js"]);

        // Act
        let result = plan_glob_tasks(&includes, &[]).unwrap();

        // Assert
        assert_eq!(result.tasks, vec![task("src", "src/a.js")]);
    }

    #[test]
    fn excludes_with_a_negated_include() {
        // Arrange
        let includes = strings(&["src/**", "!./src/nested/**"]);

        // Act
        let result = plan_glob_tasks(&includes, &[]).unwrap();

        // Assert
        assert_eq!(
            result,
            GlobPlan {
                tasks: vec![task("src", "src/**")],
                excludes: strings(&["src/nested/**"]),
            }
        );
    }

    #[test]
    fn expands_and_tidies_exclude_patterns() {
        // Arrange
        let excludes = strings(&["./{a,b}//**"]);

        // Act
        let result = plan_glob_tasks(&[], &excludes).unwrap();

        // Assert
        assert_eq!(result.excludes, strings(&["a/**", "b/**"]));
    }

    #[test]
    fn treats_a_negated_exclude_as_an_exclude() {
        // Arrange
        let excludes = strings(&["!src/a.js"]);

        // Act
        let result = plan_glob_tasks(&[], &excludes).unwrap();

        // Assert
        assert_eq!(result.excludes, strings(&["src/a.js"]));
    }

    #[test]
    fn fails_for_an_include_whose_braces_expand_too_far() {
        // Arrange
        let includes = vec!["{a,b}".repeat(20)];

        // Act
        let result = plan_glob_tasks(&includes, &[]).map(|_| ());

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            too_many_message(&"{a,b}".repeat(20))
        );
    }

    #[test]
    fn fails_for_a_negated_include_whose_braces_expand_too_far() {
        // Arrange
        let includes = vec![format!("!{}", "{a,b}".repeat(20))];

        // Act
        let result = plan_glob_tasks(&includes, &[]).map(|_| ());

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            too_many_message(&"{a,b}".repeat(20))
        );
    }

    #[test]
    fn fails_for_an_exclude_whose_braces_expand_too_far() {
        // Arrange
        let excludes = vec!["{a,b}".repeat(20)];

        // Act
        let result = plan_glob_tasks(&[], &excludes).map(|_| ());

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            too_many_message(&"{a,b}".repeat(20))
        );
    }

    #[test]
    fn expands_brace_groups() {
        // Arrange
        let pattern = "src/*.{js,ts}";

        // Act
        let result = expand_pattern_braces(pattern).unwrap();

        // Assert
        assert_eq!(result, vec!["src/*.js", "src/*.ts"]);
    }

    #[test]
    fn keeps_a_pattern_without_groups() {
        // Arrange
        let pattern = "src/é.js";

        // Act
        let result = expand_pattern_braces(pattern).unwrap();

        // Assert
        assert_eq!(result, vec!["src/é.js"]);
    }

    #[test]
    fn fails_for_a_pattern_too_long_to_expand() {
        // Arrange
        let pattern = format!("{{a,b}}{}", "x".repeat(10_000));

        // Act
        let result = expand_pattern_braces(&pattern);

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            format!("pattern is too long to expand its braces: {pattern}")
        );
    }

    #[test]
    fn fails_for_a_pattern_that_expands_too_far() {
        // Arrange
        let pattern = "{a,b}".repeat(20);

        // Act
        let result = expand_pattern_braces(&pattern);

        // Assert
        assert_eq!(
            result.unwrap_err().to_string(),
            format!("pattern's braces expand to too many patterns: {pattern}")
        );
    }
}
