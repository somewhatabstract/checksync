use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

/// Create the error for a sync-start tag that can't be decoded.
///
/// # Arguments
///
/// * `line` - The 1-based line of the tag.
///
/// # Returns
///
/// The error details.
#[must_use]
pub fn malformed_start_tag(line: usize) -> ErrorDetails {
    ErrorDetails {
        marker_id: None,
        reason: "Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'".to_owned(),
        code: ErrorCode::MalformedStartTag,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::malformed_start_tag;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: None,
            reason: "Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'".to_owned(),
            code: ErrorCode::MalformedStartTag,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = malformed_start_tag(3);

        // Assert
        assert_eq!(result, expected);
    }
}
