import path from "path";
import escapeRegExp from "lodash/escapeRegExp";
import {ErrorCode} from "./error-codes";
import rootRelativePath from "./root-relative-path";
import cwdRelativePath from "./cwd-relative-path";
import {NoChecksum} from "./types";

import {FileInfo, Marker, MarkerCache, ErrorDetails, Options} from "./types";

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
            ([_, target]: [any, any]) => aliases.includes((target as any).file),
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
            checksum: targetMarker.checksum,
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
            const targetRef = sourceMarker.targets[sourceLine];
            const targetInfo: FileInfo | null | undefined =
                cache[targetRef.file];
            const targetMarker: Marker | null | undefined =
                targetInfo?.markers[markerID];

            const targetDetails = getTargetDetail(targetMarker, aliases);

            const sourceChecksum = targetRef.checksum;
            const targetChecksum = targetDetails?.checksum;
            if (sourceChecksum === targetChecksum) {
                // If the checksum matches and we have no errors, we can skip
                // this edge.
                continue;
            }

            if (targetDetails?.line == null || targetChecksum == null) {
                yield {
                    reason: `No return tag named '${markerID}' in '${cwdRelativePath(
                        targetRef.file,
                    )}'`,
                    code: ErrorCode.noReturnTag,
                    location: {line: sourceLine},
                };
                continue;
            }

            const normalizedTargetFile = targetRef.file.replace(
                new RegExp(escapeRegExp(path.sep), "g"),
                "/",
            );

            const {commentStart, commentEnd} = sourceMarker;
            const startOfComment = targetRef.declaration.indexOf(commentStart);
            const indent = targetRef.declaration.substring(0, startOfComment);
            const checksums = `${
                sourceChecksum || NoChecksum
            } != ${targetChecksum}`;
            const fix = `${indent}${commentStart} sync-start:${markerID} ${targetChecksum} ${rootRelativePath(
                normalizedTargetFile,
                options.rootMarker,
            )}${commentEnd || ""}`;

            yield {
                code: ErrorCode.mismatchedChecksum,
                reason: `Looks like you changed the target content for sync-tag '${markerID}' in '${cwdRelativePath(
                    normalizedTargetFile,
                )}:${
                    targetDetails.line
                }'. Make sure you've made the parallel changes in the source file, if necessary (${checksums})`,
                location: {line: targetDetails.line},
                fix: {
                    type: "replace",
                    line: sourceLine,
                    text: fix,
                    declaration: targetRef.declaration,
                    description: `Updated checksum for sync-tag '${markerID}' referencing '${cwdRelativePath(
                        normalizedTargetFile,
                    )}:${targetDetails.line}' from ${
                        sourceChecksum || NoChecksum.toLowerCase()
                    } to ${targetChecksum}.`,
                },
            };
        }
    }
}
