//! Tests of how the cache handles paths that reach files through links.

use std::os::unix::fs::symlink;

use super::tests::{keys, options, root};
use crate::marker_cache::MarkerCache;

#[test]
fn adds_a_link_after_its_real_file() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("link.js")]);

    // Assert
    assert_eq!(
        keys(&cache),
        vec![root.join("a.js").as_path(), root.join("link.js").as_path()]
    );
}

#[test]
fn makes_a_link_read_only() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("link.js")]);

    // Assert
    assert!(cache.get(&root.join("link.js")).unwrap().read_only);
}

#[test]
fn shares_the_aliases_of_a_link_and_its_file() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("link.js")]);

    // Assert
    assert_eq!(
        cache.get(&root.join("a.js")).unwrap().aliases,
        [root.join("a.js"), root.join("link.js")]
    );
}

#[test]
fn reads_a_file_once_when_two_paths_reach_it() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("a.js"), root.join("link.js")]);

    // Assert
    assert_eq!(cache.contents.len(), 1);
}

#[test]
fn keeps_a_real_file_fixable_when_a_link_reaches_it_first() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("link.js")]);

    // Assert
    assert!(!cache.get(&root.join("a.js")).unwrap().read_only);
}

fn unrooted_options() -> crate::options::Options {
    crate::options::Options {
        root_marker: Some("no-such-marker-anywhere.txt".to_owned()),
        migration: None,
        ..options()
    }
}

#[test]
fn names_the_given_link_when_its_root_cannot_be_found() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&unrooted_options(), &[root.join("link.js")]);

    // Assert
    assert!(
        cache.get(&root.join("a.js")).unwrap().errors[0]
            .reason
            .starts_with(&format!(
                "Could not parse {}: Could not find marker",
                root.join("link.js").display()
            ))
    );
}

#[test]
fn gives_a_link_the_errors_of_its_file() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&unrooted_options(), &[root.join("link.js")]);

    // Assert
    assert_eq!(
        cache.get(&root.join("link.js")).unwrap().errors,
        cache.get(&root.join("a.js")).unwrap().errors
    );
}

#[test]
fn adds_a_repeated_link_to_the_aliases_each_time() {
    // Arrange
    let (_dir, root) = root(&[("a.js", "")]);
    symlink(root.join("a.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("link.js"), root.join("link.js")]);

    // Assert
    assert_eq!(
        cache.get(&root.join("a.js")).unwrap().aliases,
        [
            root.join("a.js"),
            root.join("link.js"),
            root.join("link.js")
        ]
    );
}

#[test]
fn reports_a_broken_link_under_its_own_path() {
    // Arrange
    let (_dir, root) = root(&[]);
    symlink(root.join("missing.js"), root.join("link.js")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("link.js")]);

    // Assert
    assert_eq!(keys(&cache), vec![root.join("link.js").as_path()]);
}

#[test]
fn reads_a_target_in_a_linked_folder_by_its_real_path_as_read_only() {
    // Arrange
    let (_dir, root) = root(&[
        (
            "a.js",
            "// sync-start:x linked/b.js\ncontent\n// sync-end:x\n",
        ),
        ("real/b.js", ""),
    ]);
    symlink(root.join("real"), root.join("linked")).unwrap();

    // Act
    let cache = MarkerCache::from_files(&options(), &[root.join("a.js")]);

    // Assert
    assert!(cache.get(&root.join("real/b.js")).unwrap().read_only);
}
