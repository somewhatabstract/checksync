use crate::types::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

/// Create the error for a marker that names the same target twice.
///
/// # Arguments
///
/// * `marker_id` - The id of the marker the error belongs to.
/// * `line` - The 1-based line of the tag.
/// * `declaration` - The whole line of the repeated sync-start tag, which the fix deletes.
///
/// # Returns
///
/// The error details.
#[must_use]
pub fn duplicate_target(marker_id: &str, line: usize, declaration: &str) -> ErrorDetails {
    ErrorDetails {
        marker_id: Some(marker_id.to_owned()),
        reason: format!("Duplicate target for sync-tag '{marker_id}'"),
        code: ErrorCode::DuplicateTarget,
        location: Some(ErrorLocation::at_line(line)),
        fix: Some(FixAction::Delete {
            line,
            description: format!("Removed duplicate target for sync-tag '{marker_id}'"),
            declaration: declaration.to_owned(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::duplicate_target;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Duplicate target for sync-tag 'x'".to_owned(),
            code: ErrorCode::DuplicateTarget,
            location: Some(ErrorLocation::at_line(3)),
            fix: Some(FixAction::Delete {
                line: 3,
                description: "Removed duplicate target for sync-tag 'x'".to_owned(),
                declaration: "// sync-start:x a.js".to_owned(),
            }),
        };

        // Act
        let result = duplicate_target("x", 3, "// sync-start:x a.js");

        // Assert
        assert_eq!(result, expected);
    }
}
