//! Reading one file's sync markers.

use std::fs;
use std::path::Path;

use crate::calc_checksum::calc_checksum;
use crate::errors::ErrorDetails;
use crate::get_normalized_path_info::get_normalized_path_info;
use crate::lines::{decode_utf8, split_lines};
use crate::marker_parser::MarkerParser;
use crate::node_path::node_relative;
use crate::options::Options;
use crate::relative_path::{DEFAULT_ROOT_MARKER, closesdir};
use crate::separators::normalize_separators;
use crate::types::{Marker, Markers, ParseEvent, ParsedMarker, RootMarkerError, TargetType};

/// What reading one file's sync markers found.
#[cfg_attr(
    not(test),
    expect(dead_code, reason = "the marker cache uses it in a later change")
)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ParsedFile {
    /// The file's markers, by id.
    pub markers: Markers,
    /// The local targets that exist, as resolved paths, in the order their
    /// tags appear.
    ///
    /// Only gathered for a file that isn't read-only, since those are the
    /// files whose targets get parsed too.
    pub referenced_files: Vec<String>,
    /// The problems found, in the order checksync's JavaScript reports them.
    pub errors: Vec<ErrorDetails>,
    /// How many lines the file has.
    ///
    /// `None` if the file couldn't be read.
    pub line_count: Option<usize>,
    /// Whether the file is read-only, meaning its errors are never fixed.
    pub read_only: bool,
}

impl ParsedFile {
    /// Reads a file's sync markers, as checksync's JavaScript `parseFile` does.
    ///
    /// `file` is the file's absolute path. Target paths are resolved against
    /// the file's root, the closest folder at or above it that contains the
    /// root marker. A file that can't be read gives a
    /// [`could_not_parse`](ErrorDetails::could_not_parse) error, with no
    /// markers, references or line count; the error's message is the
    /// operating system's, where the JavaScript shows Node.js's.
    ///
    /// # Errors
    ///
    /// Returns the [`RootMarkerError`] when the file's root can't be found.
    /// The JavaScript throws before reading the file in that case, and the
    /// marker cache reports it.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "the marker cache calls it in a later change")
    )]
    pub(crate) fn parse(
        options: &Options,
        file: &Path,
        read_only: bool,
    ) -> Result<Self, RootMarkerError> {
        let marker_name = options
            .root_marker
            .as_deref()
            .unwrap_or(DEFAULT_ROOT_MARKER);
        let root = closesdir(file, marker_name)?;
        let file_text = file.to_string_lossy();
        // The bytes are only needed until the lines are split out.
        let lines = match fs::read(file) {
            Ok(bytes) => split_lines(&decode_utf8(&bytes)),
            Err(error) => {
                return Ok(Self {
                    markers: Markers::new(),
                    referenced_files: Vec::new(),
                    errors: vec![ErrorDetails::could_not_parse(
                        &file_text,
                        &error.to_string(),
                    )],
                    line_count: None,
                    read_only,
                });
            }
        };

        let mut referenced_files = Vec::new();
        let mut parser = MarkerParser::new(&options.comments, |target: &str| {
            let info = get_normalized_path_info(&root, target);
            if !read_only && info.exists && info.kind == TargetType::Local {
                referenced_files.push(info.path.clone());
            }
            info
        });
        for line in &lines {
            parser.parse_line(&line.text);
        }
        let events = parser.finish();

        // The file's path is part of each self-checksum, so it's written
        // with `/` on every platform.
        let relative_file =
            normalize_separators(&node_relative(&root, &root, file).to_string_lossy());
        let mut markers = Markers::new();
        let mut errors = Vec::new();
        for event in events {
            match event {
                ParseEvent::Error(error) => errors.push(error),
                ParseEvent::Marker(parsed) => {
                    add_marker(
                        options,
                        &file_text,
                        &relative_file,
                        parsed,
                        &mut markers,
                        &mut errors,
                    );
                }
            }
        }
        Ok(Self {
            markers,
            referenced_files,
            errors,
            line_count: Some(lines.len()),
            read_only,
        })
    }
}

/// Records a finished marker, after reporting what's wrong with each of its tags.
///
/// For each sync-start tag, in line order, it reports a block with no
/// content (unless empty tags are allowed), an id already used in the file,
/// and a target that is the file itself. A later marker with the same id
/// replaces the earlier one but keeps its place.
fn add_marker(
    options: &Options,
    file: &str,
    relative_file: &str,
    parsed: ParsedMarker,
    markers: &mut Markers,
    errors: &mut Vec<ErrorDetails>,
) {
    let ParsedMarker {
        id,
        content,
        targets,
        comment_start,
        comment_end,
    } = parsed;
    for (&line, target) in &targets {
        if content.as_ref().is_none_or(Vec::is_empty) && !options.allow_empty_tags {
            errors.push(ErrorDetails::empty_marker(&id, line));
        }
        if markers.contains_key(&id) {
            errors.push(ErrorDetails::duplicate_marker(&id, line));
        }
        if target.target == file {
            errors.push(ErrorDetails::self_targeting(&id, line));
        }
    }
    let lines = content.as_deref().unwrap_or_default();
    let self_lines: Vec<&str> = lines
        .iter()
        .map(String::as_str)
        .chain(std::iter::once(relative_file))
        .collect();
    markers.insert(
        id,
        Marker {
            content_checksum: content.as_ref().map(|content| calc_checksum(content)),
            self_checksum: calc_checksum(&self_lines),
            targets,
            comment_start,
            comment_end,
        },
    );
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::ParsedFile;
    use crate::calc_checksum::calc_checksum;
    use crate::errors::ErrorDetails;
    use crate::options::Options;

    fn options() -> Options {
        Options {
            include_globs: Vec::new(),
            exclude_globs: Vec::new(),
            ignore_files: Vec::new(),
            comments: vec!["//".to_owned()],
            allow_empty_tags: false,
            root_marker: None,
            migration: None,
        }
    }

    /// Creates a root folder holding a `package.json` and the given files.
    fn root(files: &[(&str, &str)]) -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("package.json"), "{}").unwrap();
        for (name, text) in files {
            let path = dir.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
        }
        dir
    }

    fn parse(dir: &TempDir, name: &str, read_only: bool) -> ParsedFile {
        ParsedFile::parse(&options(), &dir.path().join(name), read_only).unwrap()
    }

    fn path_text(dir: &TempDir, name: &str) -> String {
        dir.path().join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn counts_the_file_lines() {
        // Arrange
        let dir = root(&[("a.js", "one\ntwo\r\nthree")]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(result.line_count, Some(3));
    }

    #[test]
    fn checksums_a_marker_content() {
        // Arrange
        let dir = root(&[(
            "a.js",
            "// sync-start:x https://example.com/b\ncontent\n// sync-end:x\n",
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(
            result.markers["x"].content_checksum,
            Some(calc_checksum(&["content\n"]))
        );
    }

    #[test]
    fn includes_the_root_relative_file_path_in_the_self_checksum() {
        // Arrange
        let dir = root(&[(
            "src/a.js",
            "// sync-start:x https://example.com/b\ncontent\n// sync-end:x\n",
        )]);

        // Act
        let result = parse(&dir, "src/a.js", false);

        // Assert
        assert_eq!(
            result.markers["x"].self_checksum,
            calc_checksum(&["content\n", "src/a.js"])
        );
    }

    #[test]
    fn gathers_the_existing_local_targets() {
        // Arrange
        let dir = root(&[
            ("a.js", "// sync-start:x b.js\ncontent\n// sync-end:x\n"),
            ("b.js", ""),
        ]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(result.referenced_files, vec![path_text(&dir, "b.js")]);
    }

    #[test]
    fn gathers_no_targets_for_a_read_only_file() {
        // Arrange
        let dir = root(&[
            ("a.js", "// sync-start:x b.js\ncontent\n// sync-end:x\n"),
            ("b.js", ""),
        ]);

        // Act
        let result = parse(&dir, "a.js", true);

        // Assert
        assert!(result.referenced_files.is_empty());
    }

    #[test]
    fn gathers_no_missing_or_remote_targets() {
        // Arrange
        let dir = root(&[(
            "a.js",
            concat!(
                "// sync-start:x missing.js\n",
                "// sync-start:x https://example.com/b\n",
                "content\n",
                "// sync-end:x\n",
            ),
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert!(result.referenced_files.is_empty());
    }

    #[test]
    fn reports_an_empty_block_for_each_tag() {
        // Arrange
        let dir = root(&[(
            "a.js",
            concat!(
                "// sync-start:x https://example.com/b\n",
                "// sync-start:x https://example.com/c\n",
                "// sync-end:x\n",
            ),
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(
            result.errors,
            vec![
                ErrorDetails::empty_marker("x", 1),
                ErrorDetails::empty_marker("x", 2)
            ]
        );
    }

    #[test]
    fn allows_an_empty_block_when_the_options_do() {
        // Arrange
        let dir = root(&[(
            "a.js",
            "// sync-start:x https://example.com/b\n// sync-end:x\n",
        )]);
        let options = Options {
            allow_empty_tags: true,
            ..options()
        };

        // Act
        let result = ParsedFile::parse(&options, &dir.path().join("a.js"), false).unwrap();

        // Assert
        assert!(result.errors.is_empty());
    }

    #[test]
    fn reports_a_repeated_marker_id() {
        // Arrange
        let dir = root(&[(
            "a.js",
            concat!(
                "// sync-start:x https://example.com/b\n",
                "one\n",
                "// sync-end:x\n",
                "// sync-start:x https://example.com/c\n",
                "two\n",
                "// sync-end:x\n",
            ),
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(result.errors, vec![ErrorDetails::duplicate_marker("x", 4)]);
    }

    #[test]
    fn keeps_the_later_of_two_markers_with_one_id() {
        // Arrange
        let dir = root(&[(
            "a.js",
            concat!(
                "// sync-start:x https://example.com/b\n",
                "one\n",
                "// sync-end:x\n",
                "// sync-start:x https://example.com/c\n",
                "two\n",
                "// sync-end:x\n",
            ),
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(
            result.markers["x"].content_checksum,
            Some(calc_checksum(&["two\n"]))
        );
    }

    #[test]
    fn keeps_a_repeated_marker_in_its_first_place() {
        // Arrange
        let dir = root(&[(
            "a.js",
            concat!(
                "// sync-start:x https://example.com/b\n",
                "one\n",
                "// sync-end:x\n",
                "// sync-start:y https://example.com/b\n",
                "two\n",
                "// sync-end:y\n",
                "// sync-start:x https://example.com/c\n",
                "three\n",
                "// sync-end:x\n",
            ),
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(result.markers.keys().collect::<Vec<_>>(), vec!["x", "y"]);
    }

    #[test]
    fn reports_a_tag_that_targets_its_own_file() {
        // Arrange
        let dir = root(&[("a.js", "// sync-start:x a.js\ncontent\n// sync-end:x\n")]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(result.errors, vec![ErrorDetails::self_targeting("x", 1)]);
    }

    #[test]
    fn keeps_parser_errors_in_order_with_marker_errors() {
        // Arrange
        let dir = root(&[(
            "a.js",
            "// sync-start:x https://example.com/b\n// sync-end:x\n// sync-end:y\n",
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(
            result.errors,
            vec![
                ErrorDetails::empty_marker("x", 1),
                ErrorDetails::end_tag_without_start_tag("y", 3)
            ]
        );
    }

    #[test]
    fn reports_a_file_that_cannot_be_read() {
        // Arrange
        let dir = root(&[]);
        let missing = dir.path().join("missing.js");
        let detail = fs::read(&missing).unwrap_err().to_string();

        // Act
        let result = ParsedFile::parse(&options(), &missing, false).unwrap();

        // Assert
        assert_eq!(
            result,
            ParsedFile {
                markers: crate::types::Markers::new(),
                referenced_files: Vec::new(),
                errors: vec![ErrorDetails::could_not_parse(
                    &missing.to_string_lossy(),
                    &detail
                )],
                line_count: None,
                read_only: false,
            }
        );
    }

    #[test]
    fn uses_the_configured_root_marker() {
        // Arrange
        let dir = root(&[
            ("sub/marker.txt", ""),
            (
                "sub/a.js",
                "// sync-start:x https://example.com/b\ncontent\n// sync-end:x\n",
            ),
        ]);
        let options = Options {
            root_marker: Some("marker.txt".to_owned()),
            ..options()
        };

        // Act
        let result = ParsedFile::parse(&options, &dir.path().join("sub/a.js"), false).unwrap();

        // Assert
        assert_eq!(
            result.markers["x"].self_checksum,
            calc_checksum(&["content\n", "a.js"])
        );
    }

    #[test]
    fn fails_when_the_root_cannot_be_found() {
        // Arrange
        let options = Options {
            root_marker: Some("no-such-marker-anywhere.txt".to_owned()),
            ..options()
        };

        let dir = root(&[]);

        // Act
        let result = ParsedFile::parse(&options, &dir.path().join("a.js"), false);

        // Assert
        assert!(
            result
                .unwrap_err()
                .to_string()
                .starts_with("Could not find marker, \"no-such-marker-anywhere.txt\"")
        );
    }

    #[test]
    fn stores_an_end_tag_without_a_start_tag_as_a_marker_without_content() {
        // Arrange
        let dir = root(&[("src/a.js", "// sync-end:x\n")]);

        // Act
        let result = parse(&dir, "src/a.js", false);

        // Assert
        assert_eq!(
            result.markers["x"],
            crate::types::Marker {
                content_checksum: None,
                self_checksum: calc_checksum(&["src/a.js"]),
                targets: crate::types::Targets::new(),
                comment_start: None,
                comment_end: None,
            }
        );
    }

    #[test]
    fn replaces_a_marker_with_a_later_end_tag_without_reporting_it() {
        // Arrange
        let dir = root(&[(
            "a.js",
            concat!(
                "// sync-start:x https://example.com/b\n",
                "content\n",
                "// sync-end:x\n",
                "// sync-end:x\n",
            ),
        )]);

        // Act
        let result = parse(&dir, "a.js", false);

        // Assert
        assert_eq!(
            result.errors,
            vec![ErrorDetails::end_tag_without_start_tag("x", 4)]
        );
    }
}
