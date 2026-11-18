//! Errors found by checking sync tags against their targets.
//!
//! The paths these errors show are already worked out by the caller, either
//! relative to the working folder or to the root, so building an error never
//! touches the file system.

use super::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

/// A sync-start tag whose checksum needs updating, and the tag that fixes it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ChecksumUpdate<'a> {
    /// The tag's whole line as it is now.
    pub declaration: &'a str,
    /// The 1-based line of the tag.
    pub line: usize,
    /// The checksum the tag has now.
    pub incorrect_checksum: &'a str,
    /// The checksum the tag should have.
    pub correct_checksum: &'a str,
    /// The tag's line with the checksum, and any target, fixed.
    pub fixed_tag: &'a str,
}

impl ChecksumUpdate<'_> {
    /// Returns the current checksum in lowercase, as fix descriptions show it.
    fn lowercase_incorrect_checksum(&self) -> String {
        self.incorrect_checksum.to_lowercase()
    }

    /// Returns the fix that replaces the tag's line with the fixed tag.
    fn fix(&self, description: String) -> FixAction {
        FixAction::Replace {
            line: self.line,
            text: self.fixed_tag.to_owned(),
            description,
            declaration: self.declaration.to_owned(),
        }
    }
}

impl ErrorDetails {
    /// Creates the error for a tag whose local target's content has changed.
    ///
    /// `target_path` is the target file, relative to the working folder, and
    /// `target_line` the 1-based line of the target's tag, where the error is
    /// located. The fix updates the checksum of the tag in `update`.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "error generation calls it in a later change")
    )]
    #[must_use]
    pub(crate) fn mismatched_checksum_for_local_target(
        marker_id: &str,
        target_path: &str,
        target_line: usize,
        update: &ChecksumUpdate<'_>,
    ) -> Self {
        let ChecksumUpdate {
            incorrect_checksum,
            correct_checksum,
            ..
        } = *update;
        Self {
            marker_id: Some(marker_id.to_owned()),
            reason: format!(
                "Looks like you changed the target content for sync-tag '{marker_id}' in '{target_path}:{target_line}'. Make sure you've made corresponding changes in the source file, if necessary ({incorrect_checksum} != {correct_checksum})"
            ),
            code: ErrorCode::MismatchedChecksum,
            location: Some(ErrorLocation::at_line(target_line)),
            fix: Some(update.fix(format!(
                "Updated checksum for sync-tag '{marker_id}' referencing '{target_path}:{target_line}' from {} to {correct_checksum}.",
                update.lowercase_incorrect_checksum()
            ))),
        }
    }

    /// Creates the error for a tag with a remote target whose checksum is out of date.
    ///
    /// `target_path` is the remote target as written in the tag. The error
    /// is located at the tag in `update`, and the fix updates its checksum.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "error generation calls it in a later change")
    )]
    #[must_use]
    pub(crate) fn mismatched_checksum_for_remote_target(
        marker_id: &str,
        target_path: &str,
        update: &ChecksumUpdate<'_>,
    ) -> Self {
        let ChecksumUpdate {
            incorrect_checksum,
            correct_checksum,
            ..
        } = *update;
        Self {
            marker_id: Some(marker_id.to_owned()),
            reason: format!(
                "Looks like you changed the content of sync-tag '{marker_id}' or the path of the file that contains the tag. Make sure you've made corresponding changes at {target_path}, if necessary ({incorrect_checksum} != {correct_checksum})"
            ),
            code: ErrorCode::MismatchedChecksum,
            location: Some(ErrorLocation::at_line(update.line)),
            fix: Some(update.fix(format!(
                "Updated checksum for sync-tag '{marker_id}' referencing '{target_path}' from {} to {correct_checksum}.",
                update.lowercase_incorrect_checksum()
            ))),
        }
    }

    /// Creates the error for a tag whose target has no tag pointing back.
    ///
    /// The error is located at `line`, the 1-based line of the tag, and its
    /// message names `target_path`, the target file.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "error generation calls it in a later change")
    )]
    #[must_use]
    pub(crate) fn no_return_tag(marker_id: &str, line: usize, target_path: &str) -> Self {
        Self {
            marker_id: Some(marker_id.to_owned()),
            reason: format!("No return tag named '{marker_id}' in '{target_path}'"),
            code: ErrorCode::NoReturnTag,
            location: Some(ErrorLocation::at_line(line)),
            fix: None,
        }
    }

    /// Creates the error for a tag whose target the configured migration would change.
    ///
    /// `old_target` is the tag's target now, relative to the root or remote,
    /// and `migrated_target` what the migration changes it to. The error is
    /// located at the tag in `update`, and the fix migrates it and updates
    /// its checksum.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "error generation calls it in a later change")
    )]
    #[must_use]
    pub(crate) fn pending_migration_for_matching_tag(
        marker_id: &str,
        old_target: &str,
        migrated_target: &str,
        update: &ChecksumUpdate<'_>,
    ) -> Self {
        let ChecksumUpdate {
            correct_checksum, ..
        } = *update;
        Self {
            marker_id: Some(marker_id.to_owned()),
            reason: format!(
                "Recommended migration to remote target '{migrated_target}' and update checksum to {correct_checksum}."
            ),
            code: ErrorCode::PendingMigration,
            location: Some(ErrorLocation::at_line(update.line)),
            fix: Some(update.fix(format!(
                "Migrated sync-tag '{marker_id}'. Target changed from '{old_target}' to '{migrated_target}'. Checksum updated from {} to {correct_checksum}",
                update.lowercase_incorrect_checksum()
            ))),
        }
    }

    /// Creates the error for a tag whose local target has no return tag, but can be migrated.
    ///
    /// The target file is `cwd_target_path` relative to the working folder,
    /// and `root_target_path` relative to the root, and `migrated_target` is
    /// what the migration changes the tag's target to. The error is located
    /// at the tag in `update`, and the fix migrates it and updates its
    /// checksum.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "error generation calls it in a later change")
    )]
    #[must_use]
    pub(crate) fn pending_migration_for_missing_target(
        marker_id: &str,
        cwd_target_path: &str,
        root_target_path: &str,
        migrated_target: &str,
        update: &ChecksumUpdate<'_>,
    ) -> Self {
        let ChecksumUpdate {
            correct_checksum, ..
        } = *update;
        Self {
            marker_id: Some(marker_id.to_owned()),
            reason: format!(
                "No return tag named '{marker_id}' in '{cwd_target_path}'. Recommend migration to remote target '{migrated_target}' and update checksum to {correct_checksum}."
            ),
            code: ErrorCode::PendingMigration,
            location: Some(ErrorLocation::at_line(update.line)),
            fix: Some(update.fix(format!(
                "Migrated sync-tag '{marker_id}'. Target changed from '{root_target_path}' to '{migrated_target}'. Checksum updated from {} to {correct_checksum}",
                update.lowercase_incorrect_checksum()
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ChecksumUpdate;
    use crate::errors::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

    const UPDATE: ChecksumUpdate<'static> = ChecksumUpdate {
        declaration: "// sync-start:x 12AB b.js",
        line: 3,
        incorrect_checksum: "12AB",
        correct_checksum: "345",
        fixed_tag: "// sync-start:x 345 b.js",
    };

    fn fix(description: &str) -> FixAction {
        FixAction::Replace {
            line: 3,
            text: "// sync-start:x 345 b.js".to_owned(),
            description: description.to_owned(),
            declaration: "// sync-start:x 12AB b.js".to_owned(),
        }
    }

    #[test]
    fn builds_the_mismatched_checksum_error_for_a_local_target() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Looks like you changed the target content for sync-tag 'x' in 'src/b.js:7'. Make sure you've made corresponding changes in the source file, if necessary (12AB != 345)".to_owned(),
            code: ErrorCode::MismatchedChecksum,
            location: Some(ErrorLocation::at_line(7)),
            fix: Some(fix(
                "Updated checksum for sync-tag 'x' referencing 'src/b.js:7' from 12ab to 345.",
            )),
        };

        // Act
        let result =
            ErrorDetails::mismatched_checksum_for_local_target("x", "src/b.js", 7, &UPDATE);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn builds_the_mismatched_checksum_error_for_a_remote_target() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Looks like you changed the content of sync-tag 'x' or the path of the file that contains the tag. Make sure you've made corresponding changes at https://example.com/b.js, if necessary (12AB != 345)".to_owned(),
            code: ErrorCode::MismatchedChecksum,
            location: Some(ErrorLocation::at_line(3)),
            fix: Some(fix(
                "Updated checksum for sync-tag 'x' referencing 'https://example.com/b.js' from 12ab to 345.",
            )),
        };

        // Act
        let result = ErrorDetails::mismatched_checksum_for_remote_target(
            "x",
            "https://example.com/b.js",
            &UPDATE,
        );

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn builds_the_no_return_tag_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "No return tag named 'x' in 'src/b.js'".to_owned(),
            code: ErrorCode::NoReturnTag,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = ErrorDetails::no_return_tag("x", 3, "src/b.js");

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn builds_the_pending_migration_error_for_a_matching_tag() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Recommended migration to remote target 'https://example.com/b.js' and update checksum to 345.".to_owned(),
            code: ErrorCode::PendingMigration,
            location: Some(ErrorLocation::at_line(3)),
            fix: Some(fix(
                "Migrated sync-tag 'x'. Target changed from 'src/b.js' to 'https://example.com/b.js'. Checksum updated from 12ab to 345",
            )),
        };

        // Act
        let result = ErrorDetails::pending_migration_for_matching_tag(
            "x",
            "src/b.js",
            "https://example.com/b.js",
            &UPDATE,
        );

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn builds_the_pending_migration_error_for_a_missing_target() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "No return tag named 'x' in '../src/b.js'. Recommend migration to remote target 'https://example.com/b.js' and update checksum to 345.".to_owned(),
            code: ErrorCode::PendingMigration,
            location: Some(ErrorLocation::at_line(3)),
            fix: Some(fix(
                "Migrated sync-tag 'x'. Target changed from 'src/b.js' to 'https://example.com/b.js'. Checksum updated from 12ab to 345",
            )),
        };

        // Act
        let result = ErrorDetails::pending_migration_for_missing_target(
            "x",
            "../src/b.js",
            "src/b.js",
            "https://example.com/b.js",
            &UPDATE,
        );

        // Assert
        assert_eq!(result, expected);
    }
}
