//! Tests for migrations, and for targets whose root can't be found.

use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use super::{RETURN_TAG, checksums, codes, errors, migrating};
use crate::errors::{ChecksumUpdate, ErrorCode, ErrorDetails};
use crate::marker_cache::MarkerCache;
use crate::marker_cache::tests::{options, root};
use crate::migration::MigrationMode;
use crate::options::Options;
use crate::types::RootMarkerError;

/// The root marker for tests with targets outside any root.
const ROOT_MARKER: &str = "checksync-file-errors-root.txt";

/// Returns the options with [`ROOT_MARKER`] as the root marker.
fn rooted(options: Options) -> Options {
    Options {
        root_marker: Some(ROOT_MARKER.to_owned()),
        ..options
    }
}

/// Creates a `root` folder, marked by [`ROOT_MARKER`] and holding `a.js`,
/// beside an empty `out` folder that no root is above.
fn beside_unrooted_folder(a_js: &str) -> (TempDir, PathBuf) {
    let dir = TempDir::new().unwrap();
    let base = fs::canonicalize(dir.path()).unwrap();
    let root = base.join("root");
    fs::create_dir(&root).unwrap();
    fs::create_dir(base.join("out")).unwrap();
    fs::write(root.join(ROOT_MARKER), "").unwrap();
    fs::write(root.join("a.js"), a_js).unwrap();
    (dir, root)
}

/// Returns the error for not finding a root above `out/b.js`.
fn root_not_found(root: &Path) -> RootMarkerError {
    RootMarkerError::NotFound {
        marker: ROOT_MARKER.to_owned(),
        from: root.parent().unwrap().join("out").join("b.js"),
    }
}

/// A tag in `a.js` whose target is `out/b.js`, outside the root.
const TAG_OUTSIDE_ROOT: &str = "// sync-start:x 123 ../out/b.js\ncontent\n// sync-end:x\n";

#[test]
fn reports_a_missing_target_the_migration_does_not_match() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n")]);
    let options = migrating(MigrationMode::Missing, &[("lib/", "https://example.com/")]);

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(
        codes(&result),
        vec![ErrorCode::FileDoesNotExist, ErrorCode::NoReturnTag]
    );
}

#[test]
fn leaves_out_a_missing_target_the_migration_matches() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n")]);
    let options = migrating(
        MigrationMode::Missing,
        &[("b.js", "https://example.com/b.js")],
    );

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(codes(&result), vec![ErrorCode::PendingMigration]);
}

#[test]
fn suggests_migrating_a_local_target_without_the_marker() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n"),
        ("b.js", ""),
    ]);
    let options = migrating(MigrationMode::Missing, &[("b", "https://example.com/b")]);
    let (_, self_checksum) = checksums(&options, &root, "a.js", "x");
    let fixed_tag = format!("// sync-start:x {self_checksum} https://example.com/b.js");
    let update = ChecksumUpdate {
        declaration: "// sync-start:x 123 b.js",
        line: 1,
        incorrect_checksum: "123",
        correct_checksum: &self_checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::pending_migration_for_missing_target(
            "x",
            "b.js",
            "b.js",
            "https://example.com/b.js",
            &update
        )]
    );
}

#[test]
fn suggests_migrating_every_matching_local_tag_in_all_mode() {
    // Arrange
    let (_dir, root) = root(&[("b.js", RETURN_TAG)]);
    let (checksum, _) = checksums(&options(), &root, "b.js", "x");
    let declaration = format!("// sync-start:x {checksum} b.js");
    fs::write(
        root.join("a.js"),
        format!("{declaration}\ncontent\n// sync-end:x\n"),
    )
    .unwrap();
    let options = migrating(MigrationMode::All, &[("b", "https://example.com/b")]);
    let (_, self_checksum) = checksums(&options, &root, "a.js", "x");
    let fixed_tag = format!("// sync-start:x {self_checksum} https://example.com/b.js");
    let update = ChecksumUpdate {
        declaration: &declaration,
        line: 1,
        incorrect_checksum: &checksum,
        correct_checksum: &self_checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::pending_migration_for_matching_tag(
            "x",
            "b.js",
            "https://example.com/b.js",
            &update
        )]
    );
}

#[test]
fn suggests_migrating_every_matching_remote_tag_in_all_mode() {
    // Arrange
    let declaration = "// sync-start:x 123 https://old.example.com/a.js";
    let (_dir, root) = root(&[("a.js", &format!("{declaration}\ncontent\n// sync-end:x\n"))]);
    let options = migrating(
        MigrationMode::All,
        &[("https://old.example.com/", "https://new.example.com/")],
    );
    let (_, self_checksum) = checksums(&options, &root, "a.js", "x");
    let fixed_tag = format!("// sync-start:x {self_checksum} https://new.example.com/a.js");
    let update = ChecksumUpdate {
        declaration,
        line: 1,
        incorrect_checksum: "123",
        correct_checksum: &self_checksum,
        fixed_tag: &fixed_tag,
    };

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(
        result,
        vec![ErrorDetails::pending_migration_for_matching_tag(
            "x",
            "https://old.example.com/a.js",
            "https://new.example.com/a.js",
            &update
        )]
    );
}

#[test]
fn checks_nothing_else_for_a_tag_the_migration_does_not_match_in_all_mode() {
    // Arrange
    let (_dir, root) = root(&[
        ("a.js", "// sync-start:x 123 b.js\ncontent\n// sync-end:x\n"),
        ("b.js", ""),
    ]);
    let options = migrating(MigrationMode::All, &[("lib/", "https://example.com/")]);

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(result, Vec::new());
}

#[test]
fn fails_when_the_root_of_a_missing_target_to_migrate_cannot_be_found() {
    // Arrange
    let (_dir, root) = beside_unrooted_folder(TAG_OUTSIDE_ROOT);
    let options = rooted(migrating(
        MigrationMode::Missing,
        &[("lib/", "https://example.com/")],
    ));
    let cache = MarkerCache::from_files(&options, &[root.join("a.js")]);

    // Act
    let result = cache.errors_for_file(&options, &root, &root.join("a.js"));

    // Assert
    assert_eq!(result.failure, Some(root_not_found(&root)));
}

#[test]
fn fails_when_the_root_of_a_target_without_the_marker_cannot_be_found() {
    // Arrange
    let (_dir, root) = beside_unrooted_folder(TAG_OUTSIDE_ROOT);
    fs::write(root.join("../out/b.js"), "").unwrap();
    let options = rooted(migrating(
        MigrationMode::Missing,
        &[("lib/", "https://example.com/")],
    ));
    let cache = MarkerCache::from_files(&options, &[root.join("a.js")]);

    // Act
    let result = cache.errors_for_file(&options, &root, &root.join("a.js"));

    // Assert
    assert_eq!(result.failure, Some(root_not_found(&root)));
}

#[test]
fn fails_when_the_root_of_a_target_cannot_be_found_in_all_mode() {
    // Arrange
    let (_dir, root) = beside_unrooted_folder(TAG_OUTSIDE_ROOT);
    fs::write(root.join("../out/b.js"), "").unwrap();
    let options = rooted(migrating(
        MigrationMode::All,
        &[("lib/", "https://example.com/")],
    ));
    let cache = MarkerCache::from_files(&options, &[root.join("a.js")]);

    // Act
    let result = cache.errors_for_file(&options, &root, &root.join("a.js"));

    // Assert
    assert_eq!(result.failure, Some(root_not_found(&root)));
}

#[test]
fn looks_for_no_root_when_the_migration_has_no_mappings() {
    // Arrange
    let (_dir, root) = beside_unrooted_folder(TAG_OUTSIDE_ROOT);
    let options = rooted(migrating(MigrationMode::Missing, &[]));

    // Act
    let result = errors(&options, &root, &["a.js"]);

    // Assert
    assert_eq!(
        codes(&result),
        vec![ErrorCode::FileDoesNotExist, ErrorCode::NoReturnTag]
    );
}

#[cfg(unix)]
#[test]
fn fails_when_the_root_of_a_linked_target_with_another_checksum_cannot_be_found() {
    // Arrange
    let (_dir, root) = beside_unrooted_folder(TAG_OUTSIDE_ROOT);
    fs::write(root.join("real.js"), RETURN_TAG).unwrap();
    let link = root.parent().unwrap().join("out/b.js");
    std::os::unix::fs::symlink(root.join("real.js"), &link).unwrap();
    let options = rooted(options());
    let cache = MarkerCache::from_files(&options, &[root.join("a.js"), link]);

    // Act
    let result = cache.errors_for_file(&options, &root, &root.join("a.js"));

    // Assert
    assert_eq!(result.failure, Some(root_not_found(&root)));
}

#[test]
fn keeps_the_errors_found_before_a_root_that_cannot_be_found() {
    // Arrange
    let (_dir, root) = beside_unrooted_folder(&format!("// sync-end:y\n{TAG_OUTSIDE_ROOT}"));
    let options = rooted(migrating(
        MigrationMode::Missing,
        &[("lib/", "https://example.com/")],
    ));
    let cache = MarkerCache::from_files(&options, &[root.join("a.js")]);

    // Act
    let result = cache.errors_for_file(&options, &root, &root.join("a.js"));

    // Assert
    assert_eq!(
        result.errors,
        vec![ErrorDetails::end_tag_without_start_tag("y", 1)]
    );
}

#[test]
fn reports_a_missing_target_in_an_earlier_block_with_the_same_id() {
    // Arrange
    let text = concat!(
        "// sync-start:x 1 b.js\nc\n// sync-end:x\n",
        "// sync-start:x 1 https://example.com\nc\n// sync-end:x\n",
    );
    let (_dir, root) = root(&[("a.js", text)]);
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
            ErrorCode::DuplicateMarker,
            ErrorCode::MismatchedChecksum
        ]
    );
}
