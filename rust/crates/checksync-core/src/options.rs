//! The settings for a checksync run.

/// The settings for a checksync run that the core logic reads.
///
/// Fields are added here as each part of the run is ported.
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "the marker cache uses it in a later change")
)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Options {
    /// The strings that can start a tag's line, such as `//` or `#`.
    pub comments: Vec<String>,
    /// Whether a tagged block may have no content.
    pub allow_empty_tags: bool,
    /// The name of the file that marks the root folder of sync-tag paths.
    ///
    /// `None` uses the default, [`crate::DEFAULT_ROOT_MARKER`].
    pub root_marker: Option<String>,
}
