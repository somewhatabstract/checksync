use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

/// Create the error for a sync-end tag that can't be decoded.
///
/// # Arguments
///
/// * `line` - The 1-based line of the tag.
///
/// # Returns
///
/// The error details.
#[must_use]
pub fn malformed_end_tag(line: usize) -> ErrorDetails {
    ErrorDetails {
        marker_id: None,
        reason: "Malformed sync-end: format should be 'sync-end:<label>'".to_owned(),
        code: ErrorCode::MalformedEndTag,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::malformed_end_tag;
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation};

    #[test]
    fn builds_the_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: None,
            reason: "Malformed sync-end: format should be 'sync-end:<label>'".to_owned(),
            code: ErrorCode::MalformedEndTag,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = malformed_end_tag(3);

        // Assert
        assert_eq!(result, expected);
    }
}
