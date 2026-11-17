//! Constructors for the errors checksync reports, one per kind of problem.

use crate::types::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

/// Creates the error for a marker whose sync-start tags differ in comment style.
///
/// The error is located at `line`, the 1-based line of the tag.
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

/// Creates the error for a marker that names the same target twice.
///
/// The error is located at `line`, the 1-based line of the repeated
/// sync-start tag, and its fix deletes that line, whose whole text is
/// `declaration`.
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

/// Creates the error for a sync-end tag with no matching sync-start tag.
///
/// The error is located at `line`, the 1-based line of the tag.
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

/// Creates the error for a sync-start tag whose target file doesn't exist.
///
/// The error is located at `line`, the 1-based line of the tag, and its
/// message names `target_path`, the target as written in the tag.
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

/// Creates the error for a sync-end tag that can't be decoded.
///
/// The error is located at `line`, the 1-based line of the tag.
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

/// Creates the error for a sync-start tag that can't be decoded.
///
/// The error is located at `line`, the 1-based line of the tag.
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

/// Creates the error for a sync-start tag after its block's content has begun.
///
/// The error is located at `line`, the 1-based line of the tag.
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

/// Creates the error for a sync-start tag with no matching sync-end tag.
///
/// The error is located at `line`, the 1-based line of the tag.
#[must_use]
pub fn start_tag_without_end_tag(marker_id: &str, line: usize) -> ErrorDetails {
    ErrorDetails {
        marker_id: Some(marker_id.to_owned()),
        reason: format!("Sync-start '{marker_id}' has no corresponding sync-end"),
        code: ErrorCode::StartTagWithoutEndTag,
        location: Some(ErrorLocation::at_line(line)),
        fix: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        different_comment_syntax, duplicate_target, end_tag_without_start_tag, file_does_not_exist,
        malformed_end_tag, malformed_start_tag, start_tag_after_content, start_tag_without_end_tag,
    };
    use crate::types::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

    #[test]
    fn builds_the_different_comment_syntax_error() {
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

    #[test]
    fn builds_the_duplicate_target_error() {
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

    #[test]
    fn builds_the_end_tag_without_start_tag_error() {
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

    #[test]
    fn builds_the_file_does_not_exist_error() {
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

    #[test]
    fn builds_the_malformed_end_tag_error() {
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

    #[test]
    fn builds_the_malformed_start_tag_error() {
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

    #[test]
    fn builds_the_start_tag_after_content_error() {
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

    #[test]
    fn builds_the_start_tag_without_end_tag_error() {
        // Arrange
        let expected = ErrorDetails {
            marker_id: Some("x".to_owned()),
            reason: "Sync-start 'x' has no corresponding sync-end".to_owned(),
            code: ErrorCode::StartTagWithoutEndTag,
            location: Some(ErrorLocation::at_line(3)),
            fix: None,
        };

        // Act
        let result = start_tag_without_end_tag("x", 3);

        // Assert
        assert_eq!(result, expected);
    }
}
