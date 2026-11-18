//! Finding the problems with one file's sync tags, using the markers of their targets.

use std::path::{Path, PathBuf};

use crate::errors::{ChecksumUpdate, ErrorCode, ErrorDetails};
use crate::js::js_object_keys;
use crate::migration::MigrationMode;
use crate::node_path::node_relative;
use crate::options::Options;
use crate::relative_path::root_relative_path;
use crate::separators::normalize_separators;
use crate::types::{Marker, RootMarkerError, Target, TargetType};

use super::MarkerCache;

/// What checksync's output shows in place of a tag's checksum when it has none.
const NO_CHECKSUM: &str = "No checksum";

impl MarkerCache {
    /// Returns the problems with one file's sync tags, as the JavaScript `generateErrors` does.
    ///
    /// The problems found reading the file come first, leaving out each
    /// missing target that the migration would change, since that's reported
    /// as a pending migration instead. Then, for a file that isn't read-only,
    /// each tag is checked against its target: a local target's tag pointing
    /// back, or a remote target's checksum. A file that isn't in the cache has
    /// no problems.
    ///
    /// Paths in messages are relative to `cwd`, the working folder.
    ///
    /// # Errors
    ///
    /// Returns the [`RootMarkerError`] when the migration has mappings and the
    /// root of a local target can't be found. The JavaScript throws in that
    /// case.
    pub(crate) fn errors_for_file(
        &self,
        options: &Options,
        cwd: &Path,
        file: &Path,
    ) -> Result<Vec<ErrorDetails>, RootMarkerError> {
        let Some(info) = self.get(file) else {
            return Ok(Vec::new());
        };
        let mut errors = Vec::new();
        for error in info.errors {
            if error.code == ErrorCode::FileDoesNotExist {
                let target = error
                    .marker_id
                    .as_ref()
                    .zip(error.location.as_ref())
                    .and_then(|(id, location)| info.markers.get(id)?.targets.get(&location.line));
                if let Some(target) = target
                    && migration(options, target)?.is_some()
                {
                    continue;
                }
            }
            errors.push(error.clone());
        }
        if info.read_only {
            return Ok(errors);
        }
        for marker_id in js_object_keys(info.markers) {
            let marker = &info.markers[marker_id];
            for (&line, target) in &marker.targets {
                let tag = SourceTag {
                    marker_id,
                    marker,
                    line,
                    target,
                };
                errors.extend(self.tag_error(options, cwd, info.aliases, &tag)?);
            }
        }
        Ok(errors)
    }

    /// Returns the problem with one sync-start tag, if it has one.
    ///
    /// `aliases` are the paths that reach the tag's file.
    fn tag_error(
        &self,
        options: &Options,
        cwd: &Path,
        aliases: &[PathBuf],
        tag: &SourceTag<'_>,
    ) -> Result<Option<ErrorDetails>, RootMarkerError> {
        let SourceTag {
            marker_id,
            marker,
            target,
            ..
        } = *tag;
        if options
            .migration
            .as_ref()
            .is_some_and(|migration| migration.mode == MigrationMode::All)
        {
            // Every tag the migration matches is migrated, whatever else is
            // wrong with it, and no other problem is reported.
            let Some(migration) = migration(options, target)? else {
                return Ok(None);
            };
            let old_target = match target.kind {
                TargetType::Local => &migration.root_target,
                TargetType::Remote => &target.target,
            };
            let fixed_tag = tag.fixed_tag(&marker.self_checksum, &migration.migrated);
            let update = tag.update(&target.checksum, &marker.self_checksum, &fixed_tag);
            return Ok(Some(ErrorDetails::pending_migration_for_matching_tag(
                marker_id,
                old_target,
                &migration.migrated,
                &update,
            )));
        }
        let incorrect_checksum = if target.checksum.is_empty() {
            NO_CHECKSUM
        } else {
            &target.checksum
        };
        match target.kind {
            TargetType::Local => {
                let return_tag = self
                    .get(Path::new(&target.target))
                    .and_then(|info| return_tag(info.markers.get(marker_id)?, aliases));
                match return_tag {
                    Some((_, checksum)) if checksum == target.checksum => Ok(None),
                    Some((target_line, checksum)) => {
                        let root_target = root_relative_target(options, target)?;
                        let fixed_tag = tag.fixed_tag(checksum, &root_target);
                        let update = tag.update(incorrect_checksum, checksum, &fixed_tag);
                        Ok(Some(ErrorDetails::mismatched_checksum_for_local_target(
                            marker_id,
                            &cwd_relative_target(cwd, target),
                            target_line,
                            &update,
                        )))
                    }
                    None => {
                        let cwd_target = cwd_relative_target(cwd, target);
                        let Some(migration) = migration(options, target)? else {
                            return Ok(Some(ErrorDetails::no_return_tag(
                                marker_id,
                                tag.line,
                                &cwd_target,
                            )));
                        };
                        let fixed_tag = tag.fixed_tag(&marker.self_checksum, &migration.migrated);
                        let update =
                            tag.update(incorrect_checksum, &marker.self_checksum, &fixed_tag);
                        Ok(Some(ErrorDetails::pending_migration_for_missing_target(
                            marker_id,
                            &cwd_target,
                            &migration.root_target,
                            &migration.migrated,
                            &update,
                        )))
                    }
                }
            }
            TargetType::Remote => {
                if target.checksum == marker.self_checksum {
                    return Ok(None);
                }
                let fixed_tag = tag.fixed_tag(&marker.self_checksum, &target.target);
                let update = tag.update(incorrect_checksum, &marker.self_checksum, &fixed_tag);
                Ok(Some(ErrorDetails::mismatched_checksum_for_remote_target(
                    marker_id,
                    &target.target,
                    &update,
                )))
            }
        }
    }
}

/// One sync-start tag in the file being checked.
#[derive(Debug, Clone, Copy)]
struct SourceTag<'a> {
    marker_id: &'a str,
    marker: &'a Marker,
    /// The 1-based line of the tag.
    line: usize,
    target: &'a Target,
}

impl SourceTag<'_> {
    /// Returns the tag's line with a new checksum and target, keeping its indentation.
    fn fixed_tag(&self, checksum: &str, target: &str) -> String {
        let comment_start = self.marker.comment_start.as_deref().unwrap_or_default();
        let declaration = &self.target.declaration;
        let indent = declaration
            .find(comment_start)
            .map_or("", |start| &declaration[..start]);
        let comment_end = self.marker.comment_end.as_deref().unwrap_or_default();
        format!(
            "{indent}{comment_start} sync-start:{} {checksum} {target}{comment_end}",
            self.marker_id
        )
    }

    /// Returns the update that replaces the tag's line with `fixed_tag`.
    fn update<'a>(
        &'a self,
        incorrect_checksum: &'a str,
        correct_checksum: &'a str,
        fixed_tag: &'a str,
    ) -> ChecksumUpdate<'a> {
        ChecksumUpdate {
            declaration: &self.target.declaration,
            line: self.line,
            incorrect_checksum,
            correct_checksum,
            fixed_tag,
        }
    }
}

/// Returns the line of a target marker's first tag that points back at one of
/// `aliases`, with the marker's content checksum.
///
/// `None` if no tag points back, or the marker has no content checksum.
fn return_tag<'a>(target_marker: &'a Marker, aliases: &[PathBuf]) -> Option<(usize, &'a str)> {
    let checksum = target_marker.content_checksum.as_deref()?;
    let (&line, _) = target_marker.targets.iter().find(|(_, target)| {
        aliases
            .iter()
            .any(|alias| alias == Path::new(&target.target))
    })?;
    Some((line, checksum))
}

/// A tag's target relative to its root, and what the migration changes it to.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Migration {
    /// The target relative to its root, with `/` between names, or a remote target as it is.
    root_target: String,
    /// What the migration changes the target to.
    migrated: String,
}

/// Returns how the configured migration changes a tag's target, if it changes it.
///
/// # Errors
///
/// Returns the [`RootMarkerError`] when the migration has mappings and the
/// target is a local file whose root can't be found.
fn migration(options: &Options, target: &Target) -> Result<Option<Migration>, RootMarkerError> {
    let Some(migration) = &options.migration else {
        return Ok(None);
    };
    // The JavaScript only works out the target's root for each mapping.
    if migration.mappings.is_empty() {
        return Ok(None);
    }
    let root_target = root_relative_target(options, target)?;
    Ok(migration
        .migrated_target(&root_target)
        .map(|migrated| Migration {
            root_target,
            migrated,
        }))
}

/// Returns a target relative to its root, with `/` between names, or a remote target as it is.
///
/// # Errors
///
/// Returns the [`RootMarkerError`] when the target is a local file whose root
/// can't be found.
fn root_relative_target(options: &Options, target: &Target) -> Result<String, RootMarkerError> {
    let path = root_relative_path(Path::new(&target.target), options.root_marker.as_deref())?;
    Ok(normalize_separators(&path.to_string_lossy()))
}

/// Returns a local target relative to the working folder, as messages show it.
fn cwd_relative_target(cwd: &Path, target: &Target) -> String {
    node_relative(cwd, cwd, Path::new(&target.target))
        .to_string_lossy()
        .into_owned()
}

#[cfg(test)]
mod tests;
