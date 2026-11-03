//! Types shared across checksync-core.

use std::collections::BTreeMap;

use indexmap::IndexMap;

/// The characters that ended a line in the original file.
///
/// Kept so that rewriting a file can preserve each line's ending (#665).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineEnding {
    /// `\n`.
    Lf,
    /// `\r\n`.
    CrLf,
    /// A `\r` not followed by `\n`.
    Cr,
    /// No ending: the last line of a file that doesn't end with a line break.
    None,
}

impl LineEnding {
    /// The characters this ending stands for.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Lf => "\n",
            Self::CrLf => "\r\n",
            Self::Cr => "\r",
            Self::None => "",
        }
    }
}

/// A line of a file: its text, without its ending, and the ending itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Line {
    /// The line's text, without its ending.
    pub text: String,
    /// The characters that ended the line.
    pub ending: LineEnding,
}

/// Whether a sync tag's target is a file checksync can read or a URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetType {
    /// A file, which checksync parses for the tag pointing back.
    Local,
    /// A URL, which checksync can't read, so it checks the tag's own content
    /// and file path instead.
    Remote,
}

/// A target named by one sync-start tag.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    /// The file path or URL the tag names, as written in the tag.
    pub target: String,
    /// Whether the target is a file or a URL.
    pub kind: TargetType,
    /// The checksum written in the tag, or empty if the tag has none.
    ///
    /// For a local target, this should match the checksum of the target's
    /// tagged block. For a remote target, it should match the tag's own
    /// self-checksum.
    pub checksum: String,
    /// The whole line declaring the tag, as it appears in the file.
    pub declaration: String,
}

/// A marker's targets, keyed by the 1-based line of each sync-start tag.
///
/// Ordered by line, as integer keys are in a JavaScript object, so they
/// come out in the same order as in checksync's JavaScript implementation.
pub type Targets = BTreeMap<usize, Target>;

/// A parsed sync marker: a tagged block of content and the targets it syncs
/// with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Marker {
    /// The checksum of the block's content.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag, which has
    /// no content. Output formats show this as `"No checksum"`.
    pub content_checksum: Option<String>,
    /// The checksum of the block's content followed by the path of its file
    /// relative to the root, which remote targets are checked against.
    pub self_checksum: String,
    /// The targets the marker syncs with.
    pub targets: Targets,
    /// The comment syntax that starts the marker's tags, such as `//`.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub comment_start: Option<String>,
    /// The text after the target on the marker's first sync-start line, such
    /// as ` */`, including the whitespace before it, or empty if there is
    /// none.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub comment_end: Option<String>,
}

/// A file's markers, keyed by marker id, in the order their blocks end.
///
/// A JavaScript object puts integer-like keys, such as `"123"`, before all
/// others, so checksync's JavaScript implementation lists a marker with such
/// an id first. Code that writes markers out in order has to do the same.
pub type Markers = IndexMap<String, Marker>;

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

    /// The code as it appears in checksync's output.
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
    /// A location covering a whole line.
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
    /// Delete the line.
    Delete {
        /// The 1-based line to delete.
        line: usize,
        /// What the fix does, for showing to the user.
        description: String,
        /// The line's current text, the tag declaration being deleted.
        declaration: String,
    },
    /// Replace the line with new text.
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
    /// The id of the marker the error belongs to, or `None` if it doesn't
    /// belong to one, such as a malformed tag.
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

/// A tag's target path resolved against the root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizedPathInfo {
    /// The resolved path, or the URL for a remote target.
    pub path: String,
    /// Whether the target exists. Always `true` for a remote target.
    pub exists: bool,
    /// Whether the target is a file or a URL.
    pub kind: TargetType,
}
