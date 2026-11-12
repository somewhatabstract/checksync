//! Types shared across checksync-core.

use std::collections::BTreeMap;
use std::fmt;
use std::path::PathBuf;

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

/// A marker the parser has read to the end of, before any checksums are
/// worked out.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMarker {
    /// The marker's id.
    pub id: String,
    /// The block's content lines, each ending with `\n`, or `None` for a
    /// sync-end tag with no matching sync-start tag.
    pub content: Option<Vec<String>>,
    /// The marker's targets, keyed by the line of each sync-start tag.
    pub targets: Targets,
    /// The comment syntax that starts the marker's first sync-start tag, or
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub comment_start: Option<String>,
    /// The text after the target on the marker's first sync-start tag, or
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub comment_end: Option<String>,
}

/// Something the marker parser reports: a finished marker or an error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseEvent {
    /// A marker whose sync-end tag has been read.
    Marker(ParsedMarker),
    /// A problem with the tags.
    Error(ErrorDetails),
}

/// Why the root folder for a path couldn't be found.
///
/// The messages match the errors the `ancesdir` package throws, which
/// checksync's JavaScript implementation reports as they are.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RootMarkerError {
    /// The search has to start from an absolute path.
    RelativeStart {
        /// The relative path the search was asked to start from.
        from: PathBuf,
    },
    /// No folder from the start up to the file system root has the marker.
    NotFound {
        /// The name of the marker file or folder.
        marker: String,
        /// The path the search started from.
        from: PathBuf,
    },
}

impl fmt::Display for RootMarkerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RelativeStart { from } => write!(
                f,
                "The starting path must be absolute, but \"{}\" is relative",
                from.display()
            ),
            Self::NotFound { marker, from } => write!(
                f,
                "Could not find marker, \"{marker}\", from given starting location \"{}\"",
                from.display()
            ),
        }
    }
}

impl std::error::Error for RootMarkerError {}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::RootMarkerError;

    #[test]
    fn describes_a_missing_root_marker_as_ancesdir_does() {
        // Arrange
        let error = RootMarkerError::NotFound {
            marker: ".root".to_owned(),
            from: PathBuf::from("/a/b"),
        };

        // Act
        let result = error.to_string();

        // Assert
        assert_eq!(
            result,
            "Could not find marker, \".root\", from given starting location \"/a/b\""
        );
    }

    #[test]
    fn describes_a_relative_start_as_ancesdir_does() {
        // Arrange
        let error = RootMarkerError::RelativeStart {
            from: PathBuf::from("a/b"),
        };

        // Act
        let result = error.to_string();

        // Assert
        assert_eq!(
            result,
            "The starting path must be absolute, but \"a/b\" is relative"
        );
    }
}

/// What an ignore file says about a path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IgnoreDecision {
    /// The path is ignored.
    Ignored,
    /// The path is explicitly unignored by a negated pattern.
    Unignored,
    /// The ignore file says nothing about the path, or the path isn't
    /// inside the ignore file's folder.
    NoOpinion,
}

/// How `glob_matches` treats slashes and letter case.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) struct GlobOptions {
    /// Whether `/` separates folders.
    ///
    /// When set, `?`, `*` and bracket sets never match `/`, and a `**` that
    /// makes up a whole folder name matches any number of folders.
    pub pathname: bool,
    /// Whether ASCII letters match regardless of case.
    ///
    /// After a `\` or inside a bracket set, the text's byte is lowercased
    /// and compared with the pattern as written, so `\A` and `[A]` match
    /// nothing, though ranges and classes such as `[A-Z]` and `[:upper:]`
    /// still match lowercase letters.
    pub casefold: bool,
}

/// One step of a parsed glob pattern.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum GlobToken {
    /// Exactly one byte of the text.
    One(ByteMatcher),
    /// Any run of bytes, including none.
    Star {
        /// Whether the run may include `/`.
        crosses_slash: bool,
    },
    /// Any number of whole folders, including none: either nothing, or any
    /// run of bytes that ends with `/`.
    AnyFolders,
}

/// What a single byte of the text has to be to match one glob token.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ByteMatcher {
    /// This byte, in either case when folding case.
    Literal(u8),
    /// This byte, written after a `\`.
    ///
    /// When folding case, the text's byte is lowercased and then compared
    /// exactly, so an escaped uppercase letter matches nothing.
    Escaped(u8),
    /// Any byte, written as `?`.
    Any,
    /// A byte from a bracket set, such as `[a-z]`.
    Set(BracketSet),
}

/// A parsed bracket expression, such as `[!a-z]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BracketSet {
    /// Whether the set was negated with a leading `!` or `^`.
    pub negated: bool,
    /// The members of the set, in the order they were written.
    pub items: Vec<BracketItem>,
}

/// One member of a bracket set.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BracketItem {
    /// A single byte.
    Byte(u8),
    /// A range of bytes, from the first to the second, as written.
    Range(u8, u8),
    /// A POSIX character class, such as `[:alpha:]`.
    Class(PosixClass),
}

/// A POSIX character class that a bracket set can name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PosixClass {
    /// Letters and digits.
    Alnum,
    /// Letters.
    Alpha,
    /// Space and tab.
    Blank,
    /// Control bytes.
    Cntrl,
    /// Decimal digits.
    Digit,
    /// Visible bytes, excluding space.
    Graph,
    /// Lowercase letters.
    Lower,
    /// Visible bytes and space.
    Print,
    /// Visible bytes that are neither letters nor digits.
    Punct,
    /// Space, tab, line feed and carriage return.
    Space,
    /// Uppercase letters.
    Upper,
    /// Hexadecimal digits.
    Xdigit,
}

/// What a `[:` inside a bracket set turned out to start.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ClassSyntax {
    /// Not a class: the `[` is an ordinary member of the set.
    NotAClass,
    /// A known class, and the index just past its closing `:]`.
    Known(PosixClass, usize),
    /// A class with a name that isn't recognized.
    Unknown,
}

/// One pattern from a `.gitignore` file, read as git reads it.
#[derive(Debug, Clone, PartialEq, Eq)]
#[expect(
    clippy::struct_excessive_bools,
    reason = "each one matches one of git's pattern flags"
)]
pub(crate) struct GitignorePattern {
    /// The pattern, without a leading `!` or a trailing `/`.
    pub pattern: Vec<u8>,
    /// How many bytes at the start of the pattern have no glob characters.
    pub literal_prefix: usize,
    /// Whether the pattern started with `!`, so a match unignores.
    pub negated: bool,
    /// Whether the pattern ended with `/`, so it only matches folders.
    pub dir_only: bool,
    /// Whether the pattern has no `/`, so it matches the last part of a
    /// path at any depth rather than the whole path.
    pub basename_only: bool,
    /// Whether the pattern is `*` followed by literal text only, such as
    /// `*.log`.
    pub ends_with: bool,
}
