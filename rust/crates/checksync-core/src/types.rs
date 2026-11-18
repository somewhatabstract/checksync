//! Types shared across checksync-core.

use std::collections::BTreeMap;
use std::fmt;
use std::path::PathBuf;

use indexmap::IndexMap;

use crate::errors::ErrorDetails;

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
    /// Returns the characters this ending stands for.
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
    /// A URL, which checksync can't read.
    ///
    /// checksync checks the tag's own content and file path instead.
    Remote,
}

/// A target named by one sync-start tag.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    /// The path the tag names, resolved against the root, or its URL.
    ///
    /// See [`crate::get_normalized_path_info()`] for how a path is resolved.
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

/// A parsed sync marker.
///
/// It's a tagged block of content and the targets it syncs with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Marker {
    /// The checksum of the block's content.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag, which has
    /// no content. Output formats show this as `"No checksum"`.
    pub content_checksum: Option<String>,
    /// The checksum remote targets are checked against.
    ///
    /// It covers the block's content followed by the path of its file
    /// relative to the root.
    pub self_checksum: String,
    /// The targets the marker syncs with.
    pub targets: Targets,
    /// The comment syntax that starts the marker's tags, such as `//`.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub comment_start: Option<String>,
    /// The text after the target on the marker's first sync-start line.
    ///
    /// This is text such as ` */`, including the whitespace before it, or
    /// empty if there is none.
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

/// A marker the parser has read to the end of.
///
/// No checksums have been worked out for it yet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMarker {
    /// The marker's id.
    pub id: String,
    /// The block's content lines, each ending with `\n`.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub content: Option<Vec<String>>,
    /// The marker's targets, keyed by the line of each sync-start tag.
    pub targets: Targets,
    /// The comment syntax that starts the marker's first sync-start tag.
    ///
    /// `None` for a sync-end tag with no matching sync-start tag.
    pub comment_start: Option<String>,
    /// The text after the target on the marker's first sync-start tag.
    ///
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
    /// The ignore file says nothing about the path.
    ///
    /// This includes a path that isn't inside the ignore file's folder.
    NoOpinion,
}
