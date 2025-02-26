import {ErrorCode} from "./error-codes";
import rootRelativePath from "./root-relative-path";
import cwdRelativePath from "./cwd-relative-path";
import {NoChecksum} from "./types";

import {FileInfo, Marker, MarkerCache, ErrorDetails, Options} from "./types";
import normalizeSeparators from "./normalize-separators";

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
    yield* fileInfo.errors;

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

            if (sourceRef.type === "local") {
                const targetInfo: FileInfo | null | undefined =
                    cache[sourceRef.target];
                const targetMarker: Marker | null | undefined =
                    targetInfo?.markers[markerID];

                const targetDetails = getTargetDetail(targetMarker, aliases);

                const currentChecksum = sourceRef.checksum;
                const targetChecksum = targetDetails?.checksum;
                if (currentChecksum === targetChecksum) {
                    // If the checksum matches and we have no errors, we can skip
                    // this edge.
                    continue;
                }

                if (targetDetails?.line == null || targetChecksum == null) {
                    yield {
                        reason: `No return tag named '${markerID}' in '${cwdRelativePath(
                            sourceRef.target,
                        )}'`,
                        code: ErrorCode.noReturnTag,
                        location: {line: sourceLine},
                    };
                    continue;
                }

                const normalizedTargetRef = normalizeSeparators(
                    sourceRef.target,
                );

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
                const fix = `${indent}${commentStart} sync-start:${markerID} ${targetChecksum} ${rootRelativePath(
                    normalizedTargetRef,
                    options.rootMarker,
                )}${commentEnd || ""}`;

                yield {
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
                    code: ErrorCode.mismatchedChecksum,
                    reason: `Looks like you changed the content of sync-tag '${markerID} or the path of the file that contains the tag'.
Make sure you've made corresponding changes at ${sourceRef.target}, if necessary (${checksums})`,
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
