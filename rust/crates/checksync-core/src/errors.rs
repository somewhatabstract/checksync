//! The errors checksync reports, and constructors for each kind of problem.

/// A kind of problem checksync reports.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    /// The file couldn't be read or parsed.
    CouldNotParse,
    /// A sync-start tag couldn't be decoded.
    MalformedStartTag,
    /// A sync-end tag couldn't be decoded.
    MalformedEndTag,
    /// A sync-end tag has no matching sync-start tag.
    EndTagWithoutStartTag,
    /// A tagged block has no content.
    EmptyMarker,
    /// A file has more than one block with the same marker id.
    DuplicateMarker,
    /// A sync-start tag has no matching sync-end tag.
    StartTagWithoutEndTag,
    /// A tag's checksum doesn't match its target.
    MismatchedChecksum,
    /// A marker names the same target more than once.
    DuplicateTarget,
    /// A sync-start tag comes after the block's content has begun.
    StartTagAfterContent,
    /// A tag's target file doesn't exist.
    FileDoesNotExist,
    /// A tag's target file has no tag pointing back.
    NoReturnTag,
    /// A tag names the file it's in.
    SelfTargeting,
    /// A marker's tags use different comment syntax.
    DifferentCommentSyntax,
    /// A tag's target would be changed by the configured migration.
    PendingMigration,
}

impl ErrorCode {
    /// Every error code, in the order checksync's JavaScript declares them.
    pub const ALL: [Self; 15] = [
        Self::CouldNotParse,
        Self::MalformedStartTag,
        Self::MalformedEndTag,
        Self::EndTagWithoutStartTag,
        Self::EmptyMarker,
        Self::DuplicateMarker,
        Self::StartTagWithoutEndTag,
        Self::MismatchedChecksum,
        Self::DuplicateTarget,
        Self::StartTagAfterContent,
        Self::FileDoesNotExist,
        Self::NoReturnTag,
        Self::SelfTargeting,
        Self::DifferentCommentSyntax,
        Self::PendingMigration,
    ];

    /// Returns the code as it appears in checksync's output.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CouldNotParse => "could-not-parse",
            Self::MalformedStartTag => "malformed-start-tag",
            Self::MalformedEndTag => "malformed-end-tag",
            Self::EndTagWithoutStartTag => "end-tag-without-start-tag",
            Self::EmptyMarker => "empty-marker",
            Self::DuplicateMarker => "duplicate-marker",
            // The misspelling is in checksync's published output, so it stays.
            Self::StartTagWithoutEndTag => "start-tag-witout-end-tag",
            Self::MismatchedChecksum => "mismatched-checksum",
            Self::DuplicateTarget => "duplicate-target",
            Self::StartTagAfterContent => "start-tag-after-content",
            Self::FileDoesNotExist => "file-does-not-exist",
            Self::NoReturnTag => "no-return-tag",
            Self::SelfTargeting => "self-targeting",
            Self::DifferentCommentSyntax => "different-comment-syntax",
            Self::PendingMigration => "pending-migration",
        }
    }
}

/// Where in a file an error was found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ErrorLocation {
    /// The 1-based line.
    pub line: usize,
    /// The column the problem starts at, if known.
    pub start_column: Option<usize>,
    /// The column the problem ends at, if known.
    pub end_column: Option<usize>,
}

impl ErrorLocation {
    /// Creates a location covering a whole line.
    #[must_use]
    pub fn at_line(line: usize) -> Self {
        Self {
            line,
            start_column: None,
            end_column: None,
        }
    }
}

/// A change to one line of a file that fixes an error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FixAction {
    /// A fix that deletes the line.
    Delete {
        /// The 1-based line to delete.
        line: usize,
        /// What the fix does, for showing to the user.
        description: String,
        /// The line's current text, the tag declaration being deleted.
        declaration: String,
    },
    /// A fix that replaces the line with new text.
    Replace {
        /// The 1-based line to replace.
        line: usize,
        /// The text to put in its place.
        text: String,
        /// What the fix does, for showing to the user.
        description: String,
        /// The line's current text, the tag declaration being replaced.
        declaration: String,
    },
}

/// A problem checksync found, with where it is and how to fix it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ErrorDetails {
    /// The id of the marker the error belongs to.
    ///
    /// `None` if it doesn't belong to one, such as a malformed tag.
    pub marker_id: Option<String>,
    /// The message shown to the user.
    pub reason: String,
    /// The kind of error.
    pub code: ErrorCode,
    /// Where the error is, if it has a location.
    pub location: Option<ErrorLocation>,
    /// How to fix the error, if it can be fixed automatically.
    pub fix: Option<FixAction>,
}

impl ErrorDetails {
    /// Creates the error for a marker whose sync-start tags differ in comment style.
    ///
    /// The error is located at `line`, the 1-based line of the tag.
    #[must_use]
    pub fn different_comment_syntax(marker_id: &str, line: usize) -> Self {
        Self {
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
    pub fn duplicate_target(marker_id: &str, line: usize, declaration: &str) -> Self {
        Self {
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
    pub fn end_tag_without_start_tag(marker_id: &str, line: usize) -> Self {
        Self {
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
    pub fn file_does_not_exist(marker_id: &str, line: usize, target_path: &str) -> Self {
        Self {
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
    pub fn malformed_end_tag(line: usize) -> Self {
        Self {
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
    pub fn malformed_start_tag(line: usize) -> Self {
        Self {
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
    pub fn start_tag_after_content(marker_id: &str, line: usize) -> Self {
        Self {
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
    pub fn start_tag_without_end_tag(marker_id: &str, line: usize) -> Self {
        Self {
            marker_id: Some(marker_id.to_owned()),
            reason: format!("Sync-start '{marker_id}' has no corresponding sync-end"),
            code: ErrorCode::StartTagWithoutEndTag,
            location: Some(ErrorLocation::at_line(line)),
            fix: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ErrorCode, ErrorDetails, ErrorLocation, FixAction};

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
        let result = ErrorDetails::different_comment_syntax("x", 3);

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
        let result = ErrorDetails::duplicate_target("x", 3, "// sync-start:x a.js");

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
        let result = ErrorDetails::end_tag_without_start_tag("x", 3);

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
        let result = ErrorDetails::file_does_not_exist("x", 3, "a.js");

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
        let result = ErrorDetails::malformed_end_tag(3);

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
        let result = ErrorDetails::malformed_start_tag(3);

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
        let result = ErrorDetails::start_tag_after_content("x", 3);

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
        let result = ErrorDetails::start_tag_without_end_tag("x", 3);

        // Assert
        assert_eq!(result, expected);
    }
}
