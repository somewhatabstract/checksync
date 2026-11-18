//! The errors checksync reports, and constructors for each kind of problem.

mod tag_errors;
mod target_errors;

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
