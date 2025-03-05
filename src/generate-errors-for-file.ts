import {ErrorCode} from "./error-codes";
import rootRelativePath from "./root-relative-path";
import cwdRelativePath from "./cwd-relative-path";
import {NoChecksum} from "./types";

import {FileInfo, Marker, MarkerCache, ErrorDetails, Options} from "./types";
import normalizeSeparators from "./normalize-separators";
import {determineMigration} from "./determine-migration";

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
    const getTargetDetail = (
        targetMarker: Marker | null | undefined,
        aliases: ReadonlyArray<string>,
    ) => {
        if (targetMarker == null) {
            return null;
        }
        // We look for a target that points to our file or an alias of our
        // file - the file is considered its own alias.
        const matchingTargets = Object.entries(targetMarker.targets).filter(
            ([_, target]) => aliases.includes(target.target),
        );
        if (matchingTargets.length === 0) {
            return null;
        }
        return {
            // We grab the line number of the first target file sync-start
            // tag for this markerID and return that as the target line.
            // This will allow us to identify the target content in our
            // messaging to the user.
            // The first index is the target, the second index is the key
            // of that target, which equates to its line number.
            line: parseInt(matchingTargets[0][0]),
            checksum: targetMarker.contentChecksum,
        };
    };

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

            // TODO: Migrations
            // 1. If mode is "all", then just determine if this should
            //    be migrated and output that, then continue.
            // 2. If mode is "missing", then we'll just do a migration for
            //    local targets when the target line is missing or the target
            //    checksum isn't available.

            if (sourceRef.type === "local") {
                const normalizedTargetRef = normalizeSeparators(
                    sourceRef.target,
                );
                const targetInfo: FileInfo | null | undefined =
                    cache[sourceRef.target];
                const targetMarker: Marker | null | undefined =
                    targetInfo?.markers[markerID];

                const targetDetails = getTargetDetail(targetMarker, aliases);

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
                        yield {
                            markerID,
                            reason: `No return tag named '${markerID}' in '${cwdRelativePath(
                                sourceRef.target,
                            )}'`,
                            code: ErrorCode.noReturnTag,
                            location: {line: sourceLine},
                        };
                    } else {
                        const {commentStart, commentEnd} = sourceMarker;
                        const startOfComment =
                            sourceRef.declaration.indexOf(commentStart);
                        const indent = sourceRef.declaration.substring(
                            0,
                            startOfComment,
                        );
                        const fix = `${indent}${commentStart} sync-start:${markerID} ${sourceMarker.selfChecksum} ${migratedTarget}${commentEnd || ""}`;
                        yield {
                            markerID,
                            reason: `No return tag named '${markerID}' in '${cwdRelativePath(
                                sourceRef.target,
                            )}'. Recommend migration to remote target '${migratedTarget}' and update checksum to ${sourceMarker.selfChecksum}.`,
                            code: ErrorCode.pendingMigration,
                            location: {line: sourceLine},
                            fix: {
                                type: "replace",
                                line: sourceLine,
                                text: fix,
                                declaration: sourceRef.declaration,
                                description: `Migrated sync-tag '${markerID}'. Target changed from '${rootRelativePath(
                                    normalizedTargetRef,
                                    options.rootMarker,
                                )}' to '${migratedTarget}'. Checksum updated from ${currentChecksum || NoChecksum.toLowerCase()} to ${sourceMarker.selfChecksum}`,
                            },
                        };
                    }
                    // We're done with this one, so skip anymore processing.
                    continue;
                }

                const checksums = `${
                    currentChecksum || NoChecksum
                } != ${targetChecksum}`;
                const {commentStart, commentEnd} = sourceMarker;
                const startOfComment =
                    sourceRef.declaration.indexOf(commentStart);
                const indent = sourceRef.declaration.substring(
                    0,
                    startOfComment,
                );
                const fix = `${indent}${commentStart} sync-start:${markerID} ${targetChecksum} ${rootRelativePath(
                    normalizedTargetRef,
                    options.rootMarker,
                )}${commentEnd || ""}`;

                yield {
                    markerID,
                    code: ErrorCode.mismatchedChecksum,
                    reason: `Looks like you changed the target content for sync-tag '${markerID}' in '${cwdRelativePath(
                        normalizedTargetRef,
                    )}:${
                        targetDetails.line
                    }'. Make sure you've made corresponding changes in the source file, if necessary (${checksums})`,
                    location: {line: targetDetails.line},
                    fix: {
                        type: "replace",
                        line: sourceLine,
                        text: fix,
                        declaration: sourceRef.declaration,
                        description: `Updated checksum for sync-tag '${markerID}' referencing '${cwdRelativePath(
                            normalizedTargetRef,
                        )}:${targetDetails.line}' from ${
                            currentChecksum || NoChecksum.toLowerCase()
                        } to ${targetChecksum}.`,
                    },
                };
            } else if (sourceRef.type === "remote") {
                // TODO: We don't currently support migrating remote tags, but we
                // could. Might be useful if code moved repos, or something,
                // I suppose.
                const currentChecksum = sourceRef.checksum;
                const targetChecksum = sourceMarker.selfChecksum;
                if (currentChecksum === targetChecksum) {
                    // If the checksum matches and we have no errors, we can skip
                    // this edge.
                    continue;
                }

                const {commentStart, commentEnd} = sourceMarker;
                const startOfComment =
                    sourceRef.declaration.indexOf(commentStart);
                const indent = sourceRef.declaration.substring(
                    0,
                    startOfComment,
                );
                const checksums = `${
                    currentChecksum || NoChecksum
                } != ${targetChecksum}`;
                const fix = `${indent}${commentStart} sync-start:${markerID} ${targetChecksum} ${sourceRef.target}${commentEnd || ""}`;

                yield {
                    markerID,
                    code: ErrorCode.mismatchedChecksum,
                    reason: `Looks like you changed the content of sync-tag '${markerID}' or the path of the file that contains the tag. Make sure you've made corresponding changes at ${sourceRef.target}, if necessary (${checksums})`,
                    location: {line: sourceLine},
                    fix: {
                        type: "replace",
                        line: sourceLine,
                        text: fix,
                        declaration: sourceRef.declaration,
                        description: `Updated checksum for sync-tag '${markerID}' referencing '${sourceRef.target}' from ${
                            currentChecksum || NoChecksum.toLowerCase()
                        } to ${targetChecksum}.`,
                    },
                };
            } else {
                throw new Error(`Unknown target type: ${sourceRef.type}`);
            }
        }
    }
}
