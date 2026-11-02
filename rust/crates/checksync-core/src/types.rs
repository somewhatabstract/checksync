//! Types shared across checksync-core.

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
