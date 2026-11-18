//! Migrating sync-tag targets from one location to another.

use indexmap::IndexMap;

/// Which tags a migration applies to.
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "the command line builds it in a later change")
)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MigrationMode {
    /// Every tag whose target a mapping matches.
    All,
    /// Only tags whose target has no tag pointing back.
    Missing,
}

/// The configured migration: which tags to change, and how.
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "the command line builds it in a later change")
)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MigrationOptions {
    /// Which tags the migration applies to.
    pub mode: MigrationMode,
    /// The target prefixes to replace, each with what replaces it.
    pub mappings: IndexMap<String, String>,
}

impl MigrationOptions {
    /// Returns the target a tag would be migrated to, if any mapping matches it.
    ///
    /// `target` is the tag's target relative to the root, with `/` between
    /// names. A mapping matches when the target starts with its prefix, and
    /// the longest matching prefix wins; an empty prefix never matches. Two
    /// different prefixes of the same length can't both start one target, so
    /// the winner never depends on the mappings' order.
    ///
    /// The prefix is replaced by the mapping's replacement as written. The
    /// JavaScript uses `String.prototype.replace`, which also expands `$&`,
    /// `` $` ``, `$'` and `$$` in the replacement; that isn't copied.
    #[must_use]
    pub(crate) fn migrated_target(&self, target: &str) -> Option<String> {
        self.mappings
            .iter()
            .filter(|(from, _)| !from.is_empty() && target.starts_with(from.as_str()))
            .max_by_key(|(from, _)| from.len())
            .map(|(from, to)| format!("{to}{}", &target[from.len()..]))
    }
}

#[cfg(test)]
mod tests {
    use indexmap::IndexMap;

    use super::{MigrationMode, MigrationOptions};

    fn migration(mappings: &[(&str, &str)]) -> MigrationOptions {
        MigrationOptions {
            mode: MigrationMode::All,
            mappings: mappings
                .iter()
                .map(|&(from, to)| (from.to_owned(), to.to_owned()))
                .collect::<IndexMap<_, _>>(),
        }
    }

    #[test]
    fn replaces_a_matching_prefix() {
        // Arrange
        let options = migration(&[("src/", "https://example.com/src/")]);

        // Act
        let result = options.migrated_target("src/a.js");

        // Assert
        assert_eq!(result.as_deref(), Some("https://example.com/src/a.js"));
    }

    #[test]
    fn uses_the_longest_matching_prefix() {
        // Arrange
        let options = migration(&[
            ("src/", "https://example.com/src/"),
            ("src/lib/", "https://example.com/lib/"),
        ]);

        // Act
        let result = options.migrated_target("src/lib/a.js");

        // Assert
        assert_eq!(result.as_deref(), Some("https://example.com/lib/a.js"));
    }

    #[test]
    fn finds_nothing_when_no_prefix_matches() {
        // Arrange
        let options = migration(&[("lib/", "https://example.com/lib/")]);

        // Act
        let result = options.migrated_target("src/a.js");

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn never_matches_an_empty_prefix() {
        // Arrange
        let options = migration(&[("", "https://example.com/")]);

        // Act
        let result = options.migrated_target("src/a.js");

        // Assert
        assert_eq!(result, None);
    }

    #[test]
    fn puts_in_the_replacement_as_written() {
        // Arrange
        let options = migration(&[("src/", "https://example.com/$&/")]);

        // Act
        let result = options.migrated_target("src/a.js");

        // Assert
        assert_eq!(result.as_deref(), Some("https://example.com/$&/a.js"));
    }
}
