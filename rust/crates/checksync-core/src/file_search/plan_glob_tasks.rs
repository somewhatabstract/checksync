use super::expand_pattern_braces::expand_pattern_braces;
use super::glob_base::glob_base;
use super::strip_leading_dot_slash::strip_leading_dot_slash;
use super::types::{GetFilesError, GlobPlan, GlobTask};

/// Plan a search: which folders to walk, for which patterns, excluding what.
///
/// Each include pattern's brace groups are expanded, and each result becomes
/// a task that walks the folder before its first glob character. An include
/// pattern starting with `!` excludes instead, as in fast-glob. Exclude
/// patterns are expanded too. Leading `./`s are dropped from every pattern.
///
/// # Arguments
///
/// * `includes` - The include patterns, relative to the working folder.
/// * `excludes` - The exclude patterns, relative to the working folder.
///
/// # Returns
///
/// The tasks and the exclude patterns.
///
/// # Errors
///
/// A pattern whose braces can't be expanded, because it's too long or
/// expands to too many patterns.
pub(super) fn plan_glob_tasks(
    includes: &[String],
    excludes: &[String],
) -> Result<GlobPlan, GetFilesError> {
    let mut plan = GlobPlan {
        tasks: Vec::new(),
        excludes: Vec::new(),
    };
    for include in includes {
        if let Some(negated) = include.strip_prefix('!') {
            plan.excludes.extend(expand_pattern_braces(negated)?);
            continue;
        }
        for pattern in expand_pattern_braces(include)? {
            let pattern = strip_leading_dot_slash(&pattern).to_owned();
            plan.tasks.push(GlobTask {
                base: glob_base(&pattern),
                pattern,
            });
        }
    }
    for exclude in excludes {
        plan.excludes.extend(expand_pattern_braces(exclude)?);
    }
    plan.excludes = plan
        .excludes
        .iter()
        .map(|exclude| strip_leading_dot_slash(exclude).to_owned())
        .collect();
    Ok(plan)
}

#[cfg(test)]
mod tests {
    use super::plan_glob_tasks;
    use crate::file_search::types::{GlobPlan, GlobTask};

    fn too_many_message(pattern: &str) -> String {
        format!("pattern's braces expand to too many patterns: {pattern}")
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|&value| value.to_owned()).collect()
    }

    fn task(base: &str, pattern: &str) -> GlobTask {
        GlobTask {
            base: base.to_owned(),
            pattern: pattern.to_owned(),
        }
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
    fn drops_a_leading_dot_slash_from_an_include() {
        // Arrange
        let includes = strings(&["./src/a.js"]);

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
        let excludes = strings(&["./{a,b}/**"]);

        // Act
        let result = plan_glob_tasks(&[], &excludes).unwrap();

        // Assert
        assert_eq!(result.excludes, strings(&["a/**", "b/**"]));
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
}
