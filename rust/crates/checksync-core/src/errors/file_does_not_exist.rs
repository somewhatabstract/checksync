use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

/// Create the error for a sync-start tag whose target file doesn't exist.
///
/// # Arguments
///
/// * `marker_id` - The id of the marker the error belongs to.
/// * `line` - The 1-based line of the tag.
/// * `target_path` - The target as written in the tag.
///
/// # Returns
///
/// The error details.
#[must_use]
pub fn file_does_not_exist(marker_id: &str, line: usize, target_path: &str) -> ErrorDetails {
    ErrorDetails {
        marker_id: Some(marker_id.to_owned()),
        reason: format!(
            "Sync-start for '{marker_id}' points to '{target_path}', which does not exist or is a directory"
        ),
        code: ErrorCode::FileDoesNotExist,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::file_does_not_exist;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Sync-start for 'x' points to 'a.js', which does not exist or is a directory"
                .to_owned(),
            code: ErrorCode::FileDoesNotExist,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = file_does_not_exist("x", 3, "a.js");

        // Assert
        assert_eq!(result, expected);
    }
}
