use indexmap::IndexMap;
use regex::Regex;

use crate::errors;
use crate::is_js_whitespace::JS_WHITESPACE_CLASS;
use crate::js_object_keys::js_object_keys;
use crate::js_trim::js_trim;
use crate::types::{
    ErrorDetails, NormalizedPathInfo, ParseEvent, ParsedMarker, Target, TargetType, Targets,
};

/// A sync-start tag recorded for an open marker.
struct TrackedTarget {
    kind: TargetType,
    checksum: String,
    line: usize,
    declaration: String,
}

/// A marker whose sync-start tags have been read but not its sync-end tag.
struct TrackedMarker {
    content: Vec<String>,
    /// Sync-start tags by normalized target path, in the order each path
    /// first appeared.
    targets: IndexMap<String, Vec<TrackedTarget>>,
    comment_start: String,
    comment_end: String,
}

/// Read sync tags from a file's lines, one line at a time.
///
/// Give it each line, in order, with [`MarkerParser::parse_line`], then call
/// [`MarkerParser::finish`] to report markers that never ended and collect
/// everything reported, in order.
///
/// It matches checksync's JavaScript parser, including where JavaScript's
/// regular expressions differ from Rust's: whitespace is JavaScript's (see
/// [`crate::is_js_whitespace`]), word characters and digits are ASCII-only,
/// and a tag line can't contain U+2028 or U+2029 except at its ends.
pub struct MarkerParser<F>
where
    F: FnMut(&str) -> NormalizedPathInfo,
{
    normalize_path: F,
    start_tag: Regex,
    start_tag_decode: Regex,
    end_tag: Regex,
    end_tag_decode: Regex,
    open_markers: IndexMap<String, TrackedMarker>,
    line_number: usize,
    events: Vec<ParseEvent>,
}

impl<F> MarkerParser<F>
where
    F: FnMut(&str) -> NormalizedPathInfo,
{
    /// Create a parser for the given comment styles.
    ///
    /// # Arguments
    ///
    /// * `comments` - The strings that can start a tag's line, such as `//`.
    /// * `normalize_path` - Resolves the target written in a sync-start tag.
    ///
    /// # Returns
    ///
    /// The parser, ready for the file's first line.
    ///
    /// # Panics
    ///
    /// Never in practice: the patterns are built from escaped comment styles
    /// around fixed expressions that are known to compile.
    #[must_use]
    pub fn new<S: AsRef<str>>(comments: &[S], normalize_path: F) -> Self {
        let comments = comments
            .iter()
            .map(|comment| format!("(?:{})", regex::escape(comment.as_ref())))
            .collect::<Vec<_>>()
            .join("|");
        let ws = JS_WHITESPACE_CLASS;
        // JavaScript's `.` matches anything but a line terminator.
        let any = r"[^\n\r\x{2028}\x{2029}]";
        let compile = |pattern: String| Regex::new(&pattern).expect("tag pattern compiles");
        Self {
            normalize_path,
            start_tag: compile(format!("^({comments})[{ws}]*sync-start:({any}*)$")),
            // Groups: the marker id, the checksum, the target, and the
            // comment end.
            start_tag_decode: compile(format!(
                "^([^{ws}]+)[{ws}]+([0-9]*)?[{ws}]*([^{ws}]*)([{ws}]+[^{ws}0-9A-Za-z_]*)?$"
            )),
            end_tag: compile(format!("^(?:{comments})[{ws}]*sync-end:({any}*)$")),
            end_tag_decode: compile(format!("^([^{ws}]+)[{ws}]*[^{ws}]*$")),
            open_markers: IndexMap::new(),
            line_number: 1,
            events: Vec::new(),
        }
    }

    /// Parse the file's next line.
    ///
    /// # Arguments
    ///
    /// * `content` - The line's text, without its line ending.
    pub fn parse_line(&mut self, content: &str) {
        let line_number = self.line_number;
        self.line_number += 1;
        let tag_search = js_trim(content);

        if let Some(start) = self.start_tag.captures(tag_search) {
            let comment_start = start.get(1).map_or("", |m| m.as_str());
            let details = start.get(2).map_or("", |m| m.as_str());
            match self.start_tag_decode.captures(details) {
                None => self.report(errors::malformed_start_tag(line_number)),
                Some(decoded) => {
                    let group = |index: usize| decoded.get(index).map_or("", |m| m.as_str());
                    let (id, checksum, target, comment_end) =
                        (group(1), group(2), group(3), group(4));
                    self.record_marker_start(
                        id,
                        target,
                        line_number,
                        checksum,
                        comment_start,
                        comment_end,
                        content,
                    );
                }
            }
            return;
        }

        if let Some(end) = self.end_tag.captures(tag_search) {
            let details = end.get(1).map_or("", |m| m.as_str());
            match self.end_tag_decode.captures(details) {
                None => self.report(errors::malformed_end_tag(line_number)),
                Some(decoded) => {
                    let id = decoded.get(1).map_or("", |m| m.as_str());
                    self.record_marker_end(id, line_number);
                }
            }
            return;
        }

        for marker in self.open_markers.values_mut() {
            marker.content.push(format!("{content}\n"));
        }
    }

    /// Report markers that never ended, and return everything reported.
    ///
    /// Each unterminated marker gets an error on each sync-start tag for its
    /// first target only, as in checksync's JavaScript parser.
    ///
    /// # Returns
    ///
    /// Every marker and error reported while parsing, in order.
    #[must_use]
    pub fn finish(mut self) -> Vec<ParseEvent> {
        let open_markers = std::mem::take(&mut self.open_markers);
        for id in js_object_keys(&open_markers) {
            let marker = &open_markers[id];
            let first_target = js_object_keys(&marker.targets)
                .first()
                .map(|path| &marker.targets[*path]);
            for target in first_target.into_iter().flatten() {
                self.report(errors::start_tag_without_end_tag(id, target.line));
            }
        }
        self.events
    }

    fn report(&mut self, error: ErrorDetails) {
        self.events.push(ParseEvent::Error(error));
    }

    #[expect(
        clippy::too_many_arguments,
        reason = "one argument for each part of the sync-start tag"
    )]
    fn record_marker_start(
        &mut self,
        id: &str,
        target_path: &str,
        line: usize,
        checksum: &str,
        comment_start: &str,
        comment_end: &str,
        declaration: &str,
    ) {
        let normalized = (self.normalize_path)(target_path);
        let marker = self
            .open_markers
            .entry(id.to_owned())
            .or_insert_with(|| TrackedMarker {
                content: Vec::new(),
                targets: IndexMap::new(),
                comment_start: comment_start.to_owned(),
                comment_end: comment_end.to_owned(),
            });

        let mut found = Vec::new();
        if marker.comment_start != comment_start {
            found.push(errors::different_comment_syntax(id, line));
        }
        if !normalized.exists {
            found.push(errors::file_does_not_exist(id, line, target_path));
        }
        if marker.targets.contains_key(&normalized.path) {
            found.push(errors::duplicate_target(id, line, declaration));
        }
        if !marker.content.is_empty() {
            found.push(errors::start_tag_after_content(id, line));
        }
        marker
            .targets
            .entry(normalized.path)
            .or_default()
            .push(TrackedTarget {
                kind: normalized.kind,
                checksum: checksum.to_owned(),
                line,
                declaration: declaration.to_owned(),
            });
        self.events.extend(found.into_iter().map(ParseEvent::Error));
    }

    fn record_marker_end(&mut self, id: &str, line: usize) {
        let marker = self.open_markers.shift_remove(id);
        if marker.is_none() {
            self.report(errors::end_tag_without_start_tag(id, line));
        }
        let parsed = match marker {
            None => ParsedMarker {
                id: id.to_owned(),
                content: None,
                targets: Targets::new(),
                comment_start: None,
                comment_end: None,
            },
            Some(marker) => {
                let mut targets = Targets::new();
                for (path, tracked) in marker.targets {
                    for target in tracked {
                        targets.insert(
                            target.line,
                            Target {
                                target: path.clone(),
                                kind: target.kind,
                                checksum: target.checksum,
                                declaration: target.declaration,
                            },
                        );
                    }
                }
                ParsedMarker {
                    id: id.to_owned(),
                    content: Some(marker.content),
                    targets,
                    comment_start: Some(marker.comment_start),
                    comment_end: Some(marker.comment_end),
                }
            }
        };
        self.events.push(ParseEvent::Marker(parsed));
    }
}

#[cfg(test)]
mod tests {
    use super::MarkerParser;
    use crate::errors;
    use crate::types::{NormalizedPathInfo, ParseEvent, ParsedMarker, Target, TargetType, Targets};

    /// Resolve every target as an existing local file.
    fn existing(target: &str) -> NormalizedPathInfo {
        NormalizedPathInfo {
            path: target.to_owned(),
            exists: true,
            kind: TargetType::Local,
        }
    }

    #[test]
    fn reports_a_finished_marker() {
        // Arrange
        let mut parser = MarkerParser::new(&["//"], existing);
        parser.parse_line("// sync-start:x 123 a.js");
        parser.parse_line("  body");
        parser.parse_line("// sync-end:x");

        // Act
        let result = parser.finish();

        // Assert
        assert_eq!(
            result,
            [ParseEvent::Marker(ParsedMarker {
                id: "x".to_owned(),
                content: Some(vec!["  body\n".to_owned()]),
                targets: Targets::from([(
                    1,
                    Target {
                        target: "a.js".to_owned(),
                        kind: TargetType::Local,
                        checksum: "123".to_owned(),
                        declaration: "// sync-start:x 123 a.js".to_owned(),
                    }
                )]),
                comment_start: Some("//".to_owned()),
                comment_end: Some(String::new()),
            })]
        );
    }

    #[test]
    fn passes_each_target_as_written_to_normalize_path() {
        // Arrange
        let mut seen = Vec::new();
        let mut parser = MarkerParser::new(&["//"], |target: &str| {
            seen.push(target.to_owned());
            existing(target)
        });
        parser.parse_line("// sync-start:x 1 a.js");
        parser.parse_line("// sync-start:x https://example.com/b");

        // Act
        let _ = parser.finish();

        // Assert
        assert_eq!(seen, ["a.js", "https://example.com/b"]);
    }

    #[test]
    fn reports_an_unterminated_marker_when_finished() {
        // Arrange
        let mut parser = MarkerParser::new(&["//"], existing);
        parser.parse_line("// sync-start:x a.js");
        parser.parse_line("body");

        // Act
        let result = parser.finish();

        // Assert
        assert_eq!(
            result,
            [ParseEvent::Error(errors::start_tag_without_end_tag("x", 1))]
        );
    }

    #[test]
    fn treats_comment_styles_as_literal_text() {
        // Arrange
        // Unescaped, `/*` would also match a lone `/`.
        let mut parser = MarkerParser::new(&["/*"], existing);
        parser.parse_line("/ sync-start:x a.js");

        // Act
        let result = parser.finish();

        // Assert
        assert_eq!(result, []);
    }
}
