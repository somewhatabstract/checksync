use std::fs;
use std::path::Path;

use crate::errors::{ChecksumUpdate, ErrorCode, ErrorDetails};
use crate::marker_cache::MarkerCache;
use crate::marker_cache::tests::{options, root};
use crate::migration::{MigrationMode, MigrationOptions};
use crate::options::Options;

/// Returns the default options with a migration of the given mode and mappings.
pub(super) fn migrating(mode: MigrationMode, mappings: &[(&str, &str)]) -> Options {
    Options {
        migration: Some(MigrationOptions {
            mode,
            mappings: mappings
                .iter()
                .map(|&(from, to)| (from.to_owned(), to.to_owned()))
                .collect(),
        }),
        ..options()
    }
}

/// Builds the cache from `files` under `root`, and returns the errors for the first one.
pub(super) fn errors(options: &Options, root: &Path, files: &[&str]) -> Vec<ErrorDetails> {
    let paths: Vec<_> = files.iter().map(|file| root.join(file)).collect();
    let cache = MarkerCache::from_files(options, &paths);
    cache.errors_for_file(options, root, &paths[0]).errors
}

/// Returns the content and self checksums of a file's marker.
pub(super) fn checksums(
    options: &Options,
    root: &Path,
    file: &str,
    marker_id: &str,
) -> (String, String) {
    let path = root.join(file);
    let cache = MarkerCache::from_files(options, std::slice::from_ref(&path));
    let marker = &cache.get(&path).unwrap().markers[marker_id];
    (
        marker.content_checksum.clone().unwrap(),
        marker.self_checksum.clone(),
    )
}

pub(super) fn codes(errors: &[ErrorDetails]) -> Vec<ErrorCode> {
    errors.iter().map(|error| error.code).collect()
}

pub(super) const RETURN_TAG: &str = "// sync-start:x a.js\ncontent\n// sync-end:x\n";

#[test]
fn finds_nothing_for_a_file_not_in_the_cache() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    let cache = MarkerCache::from_files(&options(), &[root.join("a.js")]);

    // Act
    let result = cache
        .errors_for_file(&options(), &root, &root.join("missing.js"))
        .errors;

    // Assert
    assert_eq!(result, Vec::new());
}

#[test]
fn reports_the_errors_found_reading_the_file() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "// sync-end:x\n")]);

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::end_tag_without_start_tag("x", 1)]
    );
}

#[test]
fn reports_a_missing_target_whose_marker_has_no_end_tag() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "// sync-start:x 123 b.js\ncontent\n")]);
    let options = migrating(
        MigrationMode::Missing,
        &[("b.js", "https://example.com/b.js")],
    );

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(
        codes(&result),
        vec![
            ErrorCode::FileDoesNotExist,
            ErrorCode::StartTagWithoutEndTag
        ]
    );
}

#[test]
fn reports_the_errors_found_reading_a_read_only_file() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x b.js\ncontent\n// sync-end:x\n"),
        ("b.js", "// sync-end:y\n"),
    ]);
    let cache = MarkerCache::from_files(&options(), &[root.join("a.js")]);

    // Act
    let result = cache
        .errors_for_file(&options(), &root, &root.join("b.js"))
        .errors;

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::end_tag_without_start_tag("y", 1)]
    );
}

#[test]
fn checks_no_tags_in_a_read_only_file() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x b.js\ncontent\n// sync-end:x\n"),
        ("b.js", "// sync-start:x 123 a.js\ncontent\n// sync-end:x\n"),
    ]);
    let cache = MarkerCache::from_files(&options(), &[root.join("a.js")]);

    // Act
    let result = cache
        .errors_for_file(&options(), &root, &root.join("b.js"))
        .errors;

    // Assert
    assert_eq!(result, Vec::new());
}

#[test]
fn finds_nothing_when_a_local_target_checksum_matches() {
    // Arrange
    let (_dir, root) = root(&[("b.js", RETURN_TAG)]);
    let (checksum, _) = checksums(&options(), &root, "b.js", "x");
    let tag = format!("// sync-start:x {checksum} b.js\ncontent\n// sync-end:x\n");
    fs::write(root.join("a.js"), tag).unwrap();

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(result, Vec::new());
}

#[test]
fn reports_a_local_target_whose_checksum_differs() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n"),
        (
            "b.js",
            concat!("\n", "// sync-start:x a.js\ncontent\n// sync-end:x\n"),
        ),
    ]);
    let (checksum, _) = checksums(&options(), &root, "b.js", "x");
    let fixed_tag = format!("// sync-start:x {checksum} b.js");
    let update = ChecksumUpdate {
        declaration: "// sync-start:x 123 b.js",
        line: 1,
        incorrect_checksum: "123",
        correct_checksum: &checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::mismatched_checksum_for_local_target(
            "x", "b.js", 2, &update
        )]
    );
}

#[test]
fn shows_a_missing_checksum_as_no_checksum() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x b.js\ncontent\n// sync-end:x\n"),
        ("b.js", RETURN_TAG),
    ]);
    let (checksum, _) = checksums(&options(), &root, "b.js", "x");
    let fixed_tag = format!("// sync-start:x {checksum} b.js");
    let update = ChecksumUpdate {
        declaration: "// sync-start:x b.js",
        line: 1,
        incorrect_checksum: "No checksum",
        correct_checksum: &checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::mismatched_checksum_for_local_target(
            "x", "b.js", 1, &update
        )]
    );
}

#[test]
fn reports_a_local_target_without_the_marker() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n"),
        ("b.js", ""),
    ]);

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(result, vec![ErrorDetails::no_return_tag("x", 1, "b.js")]);
}

#[test]
fn reports_a_local_target_whose_marker_does_not_point_back() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n"),
        ("b.js", "// sync-start:x c.js\ncontent\n// sync-end:x\n"),
        ("c.js", ""),
    ]);

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(result, vec![ErrorDetails::no_return_tag("x", 1, "b.js")]);
}

#[test]
fn reports_a_local_target_whose_marker_is_an_unmatched_end_tag() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n"),
        ("b.js", "// sync-end:x\n"),
    ]);

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(result, vec![ErrorDetails::no_return_tag("x", 1, "b.js")]);
}

#[test]
fn finds_nothing_when_a_remote_target_checksum_matches() {
    // Arrange
    let (_dir, root) = root(&[(
        "a.js",
        "// sync-start:x https://example.com\nc\n// sync-end:x\n",
    )]);
    let (_, self_checksum) = checksums(&options(), &root, "a.js", "x");
    let tag = format!("// sync-start:x {self_checksum} https://example.com\nc\n// sync-end:x\n");
    fs::write(root.join("a.js"), tag).unwrap();

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(result, Vec::new());
}

#[test]
fn reports_a_remote_target_whose_checksum_differs() {
    // Arrange
    let declaration = "// sync-start:x 123 https://example.com";
    let (_dir, root) = root(&[("a.js", &format!("{declaration}\ncontent\n// sync-end:x\n"))]);
    let (_, self_checksum) = checksums(&options(), &root, "a.js", "x");
    let fixed_tag = format!("// sync-start:x {self_checksum} https://example.com");
    let update = ChecksumUpdate {
        declaration,
        line: 1,
        incorrect_checksum: "123",
        correct_checksum: &self_checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::mismatched_checksum_for_remote_target(
            "x",
            "https://example.com",
            &update
        )]
    );
}

#[test]
fn keeps_the_indent_and_comment_end_in_a_fixed_tag() {
    // Arrange
    let declaration = "  /* sync-start:x 123 https://example.com */";
    let text = format!("{declaration}\n  content\n  /* sync-end:x */\n");
    let (_dir, root) = root(&[("a.css", &text)]);
    let options = Options {
        comments: vec!["/*".to_owned()],
        ..options()
    };
    let (_, self_checksum) = checksums(&options, &root, "a.css", "x");
    let fixed_tag = format!("  /* sync-start:x {self_checksum} https://example.com */");
    let update = ChecksumUpdate {
        declaration,
        line: 1,
        incorrect_checksum: "123",
        correct_checksum: &self_checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options, &root, &["a.css"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::mismatched_checksum_for_remote_target(
            "x",
            "https://example.com",
            &update
        )]
    );
}

#[test]
fn checks_markers_with_array_index_ids_first() {
    // Arrange
    let text = concat!(
        "// sync-start:b 123 https://example.com\nc\n// sync-end:b\n",
        "// sync-start:1 123 https://example.com\nc\n// sync-end:1\n",
    );
    let (_dir, root) = root(&[("a.js", text)]);

    // Act
    let result = errors(&options(), &root, &["a.js"]);

    // Assert
    assert_eq!(
        result
            .iter()
            .map(|error| error.marker_id.as_deref().unwrap())
            .collect::<Vec<_>>(),
        vec!["1", "b"]
    );
}

#[cfg(unix)]
#[test]
fn accepts_a_return_tag_naming_a_link_to_the_file() {
    // Arrange
    let (_dir, root) = root(&[("b.js", "// sync-start:x link.js\ncontent\n// sync-end:x\n")]);
    std::os::unix::fs::symlink(root.join("a.js"), root.join("link.js")).unwrap();
    let (checksum, _) = checksums(&options(), &root, "b.js", "x");
    let tag = format!("// sync-start:x {checksum} b.js\ncontent\n// sync-end:x\n");
    fs::write(root.join("a.js"), tag).unwrap();

    // Act
    let result = errors(&options(), &root, &["a.js", "link.js"]);

    // Assert
    assert_eq!(result, Vec::new());
}

mod migration_tests;
