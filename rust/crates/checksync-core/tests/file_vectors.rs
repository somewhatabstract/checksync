//! Check `get_files` against the file-finding vectors shared with TypeScript.
//!
//! Both implementations find the same files in the same order, apart from
//! the deliberate differences recorded in the vectors' `rust` fields.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use checksync_core::get_files;
use serde::Deserialize;
use tempfile::TempDir;

/// The shared table: a tree of files and links, and the searches to run in it.
#[derive(Deserialize)]
struct Table {
    files: BTreeMap<String, String>,
    symlinks: BTreeMap<String, String>,
    vectors: Vec<Vector>,
}

/// A result the Rust implementation gives differently on purpose.
#[derive(Deserialize)]
struct RustDivergence {
    expected: Vec<String>,
    reason: String,
}

/// One search, run from `cwd`, and the files it should find, relative to the
/// tree's root.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    description: String,
    cwd: String,
    include: Vec<String>,
    exclude: Vec<String>,
    ignore_files: Vec<String>,
    expected: Vec<String>,
    rust: Option<RustDivergence>,
}

impl Vector {
    /// The files the Rust implementation should find.
    fn rust_expected(&self) -> &[String] {
        self.rust
            .as_ref()
            .map_or(self.expected.as_slice(), |rust| rust.expected.as_slice())
    }
}

const TABLE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../__conformance__/file-vectors.json"
));

fn load_table() -> Table {
    let table: Table = serde_json::from_str(TABLE).expect("valid vector table");
    // Without this, an empty table would pass because there's nothing to
    // mismatch.
    assert!(!table.vectors.is_empty(), "the vector table has no vectors");
    table
}

/// Make a link at `link` to the relative `target`, as a folder link when the
/// target is a folder.
fn make_link(link: &Path, target: &str) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).expect("make link");
    #[cfg(windows)]
    {
        // A Windows link's target needs Windows separators to be followed.
        let target = target.replace('/', "\\");
        let resolved = link.parent().expect("link folder").join(&target);
        if resolved.is_dir() {
            std::os::windows::fs::symlink_dir(&target, link).expect("make folder link");
        } else {
            std::os::windows::fs::symlink_file(&target, link).expect("make file link");
        }
    }
}

/// Create the table's tree under a new root folder.
fn create_tree(table: &Table) -> (TempDir, PathBuf) {
    let dir = TempDir::new().expect("temporary folder");
    // Paths come back as the working folder names them, so use the folder's
    // real path: on macOS the temporary folder is behind a link.
    #[cfg(unix)]
    let root = fs::canonicalize(dir.path()).expect("real path");
    #[cfg(not(unix))]
    let root = dir.path().to_path_buf();
    for (file, contents) in &table.files {
        let path = root.join(file);
        fs::create_dir_all(path.parent().expect("file folder")).expect("make folders");
        fs::write(path, contents).expect("write file");
    }
    for (link, target) in &table.symlinks {
        let path = root.join(link);
        fs::create_dir_all(path.parent().expect("link folder")).expect("make folders");
        make_link(&path, target);
    }
    (dir, root)
}

/// Write a found file relative to the tree's root, with `/` between names.
fn relative_to_root(root: &Path, file: &Path) -> String {
    file.strip_prefix(root)
        .expect("file inside the root")
        .to_string_lossy()
        .replace('\\', "/")
}

#[test]
fn has_vectors_to_check() {
    // Arrange
    let table = load_table();

    // Act
    let count = table.vectors.len();

    // Assert
    assert!(count > 0);
}

#[test]
fn explains_every_divergence() {
    // Arrange
    let table = load_table();

    // Act
    let unexplained: Vec<&str> = table
        .vectors
        .iter()
        .filter(|vector| {
            vector.rust.as_ref().is_some_and(|rust| {
                rust.reason.trim().is_empty() || rust.expected == vector.expected
            })
        })
        .map(|vector| vector.description.as_str())
        .collect();

    // Assert
    assert!(
        unexplained.is_empty(),
        "divergences need a reason and a different result: {unexplained:?}"
    );
}

#[test]
fn finds_every_vector_as_typescript_does_apart_from_divergences() {
    // Arrange
    let table = load_table();
    let (_dir, root) = create_tree(&table);

    // Act
    let mismatches: Vec<(&str, Vec<String>)> = table
        .vectors
        .iter()
        .filter_map(|vector| {
            let found = get_files(
                &vector.include,
                &vector.exclude,
                &vector.ignore_files,
                &root.join(&vector.cwd),
            )
            .expect("files found");
            let found: Vec<String> = found
                .iter()
                .map(|file| relative_to_root(&root, file))
                .collect();
            (found != vector.rust_expected()).then_some((vector.description.as_str(), found))
        })
        .collect();

    // Assert
    assert!(
        mismatches.is_empty(),
        "vectors found different files: {mismatches:#?}"
    );
}
