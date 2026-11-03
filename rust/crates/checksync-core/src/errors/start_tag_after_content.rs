use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

/// Create the error for a sync-start tag after its block's content has begun.
///
/// # Arguments
///
/// * `marker_id` - The id of the marker the error belongs to.
/// * `line` - The 1-based line of the tag.
///
/// # Returns
///
/// The error details.
#[must_use]
pub fn start_tag_after_content(marker_id: &str, line: usize) -> ErrorDetails {
    ErrorDetails {
        marker_id: Some(marker_id.to_owned()),
        reason: format!("Sync-start for '{marker_id}' found after content started"),
        code: ErrorCode::StartTagAfterContent,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::start_tag_after_content;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Sync-start for 'x' found after content started".to_owned(),
            code: ErrorCode::StartTagAfterContent,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = start_tag_after_content("x", 3);

        // Assert
        assert_eq!(result, expected);
    }
}
