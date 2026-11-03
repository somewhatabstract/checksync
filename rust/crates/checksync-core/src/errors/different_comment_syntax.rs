use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

/// Create the error for a marker whose sync-start tags use different comment styles.
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
pub fn different_comment_syntax(marker_id: &str, line: usize) -> ErrorDetails {
    ErrorDetails {
        marker_id: Some(marker_id.to_owned()),
        reason: format!(
            "Sync-start tags for '{marker_id}' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers."
        ),
        code: ErrorCode::DifferentCommentSyntax,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::different_comment_syntax;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Sync-start tags for 'x' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers.".to_owned(),
            code: ErrorCode::DifferentCommentSyntax,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = different_comment_syntax("x", 3);

        // Assert
        assert_eq!(result, expected);
    }
}
