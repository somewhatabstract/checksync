import {ErrorCode} from "./error-codes";
import * as Errors from "./errors";
import rootRelativePath from "./root-relative-path";
import cwdRelativePath from "./cwd-relative-path";
import {NoChecksum} from "./types";

import {FileInfo, Marker, MarkerCache, ErrorDetails, Options} from "./types";
import normalizeSeparators from "./normalize-separators";
import {determineMigration} from "./determine-migration";
import {getTargetDetailsForAlias} from "./get-target-details-for-alias";
import {formatSyncTagStart} from "./format-sync-tag-start";

/**
 * Generate errors for a given source file.
 *
 * Given a marker cache and a source file, this generates a sequence of the
 * various errors the source file has.
 *
 * @export
 * @param {Options} options The option uses to run checksync.
 * @param {string} file The source file for which to generate edges.
 * @param {MarkerCache} cache The marker cache to use to build the edges.
 * @returns {Iterator<MarkerEdge>} An iterator of the edges.
 */
export default function* generateErrors(
    options: Options,
    file: string,
    cache: Readonly<MarkerCache>,
): Iterable<ErrorDetails> {
    const fileInfo = cache[file];
    if (fileInfo == null) {
        // If, for some reason, this file doesn't exist, just skip it.
        return;
    }

    // First, we need to report the errors we got during parsing.
    for (const error of fileInfo.errors) {
        if (error.code === ErrorCode.fileDoesNotExist) {
            // Does this error relate to a migrateable target?
            const sourceMarker = fileInfo.markers[error.markerID!];
            // Malformed tags won't have a source marker.
            if (sourceMarker) {
                const sourceRef = sourceMarker.targets[error.location!.line];
                if (determineMigration(options, sourceRef) != null) {
                    // We will migrate this later.
                    continue;
                }
            }
        }
        yield error;
    }

    // Now, let's look at the markers and trace errors for those.
    // We only care about these in file that are not read-only since we
    // don't report ones that were only loaded for reference as a target to
    // a marker that we can actually fix.
    const {markers, aliases, readOnly} = fileInfo;
    if (readOnly) {
        return;
    }

    for (const markerID of Object.keys(markers)) {
        const sourceMarker = markers[markerID];

        const targetLines = Object.keys(sourceMarker.targets).map((line) =>
            parseInt(line),
        );

        /**
         * Here we iterate all the targets (the sync-start tags) in the source
         * file and then try to map them to the target marker they reference.
         */
        for (const sourceLine of targetLines) {
            const sourceRef = sourceMarker.targets[sourceLine];
            const startOfComment = sourceRef.declaration.indexOf(
                sourceMarker.commentStart,
            );
            const indent = sourceRef.declaration.substring(0, startOfComment);

            // If migration mode is "all", then the first thing we do is
            // see if this is a matching migration. If it is, we don't care
            // about mismatched checksums or missing return tags, we just
            // report the pending migration.
            if (options.migration?.mode === "all") {
                const migratedTarget = determineMigration(options, sourceRef);
                if (migratedTarget != null) {
                    const oldTarget =
                        sourceRef.type === "local"
                            ? normalizeSeparators(
                                  rootRelativePath(
                                      sourceRef.target,
                                      options.rootMarker,
                                  ),
                              )
                            : sourceRef.target;
                    yield Errors.pendingMigrationForMatchingTag(
                        markerID,
                        sourceRef.declaration,
                        sourceLine,
                        oldTarget,
                        migratedTarget,
                        sourceRef.checksum,
                        sourceMarker.selfChecksum,
                        `${indent}${formatSyncTagStart(
                            markerID,
                            sourceMarker.commentStart,
                            sourceMarker.commentEnd,
                            sourceMarker.selfChecksum,
                            migratedTarget,
                        )}`,
                    );
                }
                continue;
            }

            if (sourceRef.type === "local") {
                const targetInfo: FileInfo | null | undefined =
                    cache[sourceRef.target];
                const targetMarker: Marker | null | undefined =
                    targetInfo?.markers[markerID];

                const targetDetails = getTargetDetailsForAlias(
                    targetMarker,
                    aliases,
                );

                const currentChecksum = sourceRef.checksum;
                const targetChecksum = targetDetails?.checksum;

                if (currentChecksum === targetChecksum) {
                    // If the checksum matches and we have no errors, we can
                    // skip this edge.
                    continue;
                }

                if (targetDetails?.line == null || targetChecksum == null) {
                    // This is a missing return tag.
                    // Can be because the target file doesn't exist or there's
                    // no corresponding tag in that file. We don't split that
                    // hair here; if the tag is not there, and we have a
                    // migration, then we report it as a pending migration.
                    const migratedTarget = determineMigration(
                        options,
                        sourceRef,
                    );
                    if (migratedTarget == null) {
                        yield Errors.noReturnTag(
                            markerID,
                            sourceLine,
                            cwdRelativePath(sourceRef.target),
                        );
                    } else {
                        yield Errors.pendingMigrationForMissingTarget(
                            options,
                            markerID,
                            sourceRef.declaration,
                            sourceLine,
                            sourceRef.target,
                            migratedTarget,
                            currentChecksum || NoChecksum,
                            sourceMarker.selfChecksum,
                            `${indent}${formatSyncTagStart(
                                markerID,
                                sourceMarker.commentStart,
                                sourceMarker.commentEnd,
                                sourceMarker.selfChecksum,
                                migratedTarget,
                            )}`,
                        );
                    }
                    // We're done with this one, so skip anymore processing.
                    continue;
                }

                yield Errors.mismatchedChecksumForLocalTarget(
                    markerID,
                    sourceRef.declaration,
                    sourceRef.target,
                    targetDetails.line,
                    sourceLine,
                    currentChecksum || NoChecksum,
                    targetChecksum,
                    `${indent}${formatSyncTagStart(
                        markerID,
                        sourceMarker.commentStart,
                        sourceMarker.commentEnd,
                        targetChecksum,
                        normalizeSeparators(
                            rootRelativePath(
                                sourceRef.target,
                                options.rootMarker,
                            ),
                        ),
                    )}`,
                );
            } else if (sourceRef.type === "remote") {
                const currentChecksum = sourceRef.checksum;
                const targetChecksum = sourceMarker.selfChecksum;
                if (currentChecksum === targetChecksum) {
                    // If the checksum matches and we have no errors, we can skip
                    // this edge.
                    continue;
                }

                yield Errors.mismatchedChecksumForRemoteTarget(
                    markerID,
                    sourceRef.declaration,
                    sourceRef.target,
                    sourceLine,
                    currentChecksum || NoChecksum,
                    targetChecksum,
                    `${indent}${formatSyncTagStart(
                        markerID,
                        sourceMarker.commentStart,
                        sourceMarker.commentEnd,
                        targetChecksum,
                        sourceRef.target,
                    )}`,
                );
            } else {
                throw new Error(`Unknown target type: ${sourceRef.type}`);
            }
        }
    }
}
