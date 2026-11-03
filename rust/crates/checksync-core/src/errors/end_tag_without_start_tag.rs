use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

/// Create the error for a sync-end tag with no matching sync-start tag.
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
pub fn end_tag_without_start_tag(marker_id: &str, line: usize) -> ErrorDetails {
    ErrorDetails {
        marker_id: Some(marker_id.to_owned()),
        reason: format!(
            "Sync-end for '{marker_id}' found, but there was no corresponding sync-start"
        ),
        code: ErrorCode::EndTagWithoutStartTag,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::end_tag_without_start_tag;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Sync-end for 'x' found, but there was no corresponding sync-start".to_owned(),
            code: ErrorCode::EndTagWithoutStartTag,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = end_tag_without_start_tag("x", 3);

        // Assert
        assert_eq!(result, expected);
    }
}
