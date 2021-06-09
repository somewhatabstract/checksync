// @flow
import path from "path";
import escapeRegExp from "lodash/escapeRegExp";
import Format from "./format.js";
import reportErrors from "./report-errors.js";

import type {
    IPositionLog,
    FileInfo,
    Marker,
    MarkerCache,
    MarkerEdge,
} from "./types.js";

/**
 * Generate marker edges from source file to target file.
 *
 * Given a marker cache and a source file, this generates all marker edges
 * between source and target.
 *
 * @export
 * @param {string} file The source file for which to generate edges.
 * @param {MarkerCache} cache The marker cache to use to build the edges.
 * @returns {Iterator<MarkerEdge>} An iterator of the edges.
 */
export default function* generateMarkerEdges(
    file: string,
    cache: $ReadOnly<MarkerCache>,
    log: IPositionLog,
): Iterator<MarkerEdge> {
    const getTargetDetail = (targetMarker: ?Marker, aliases: Array<string>) => {
        if (targetMarker == null) {
            return null;
        }
        // We look for a target that points to our file or an alias of our
        // file - the file is considered its own alias.
        const matchingTargets = Object.entries(targetMarker.targets).filter(
            ([_, target]) => aliases.includes((target: any).file),
        );
        if (matchingTargets.length === 0) {
            return null;
        }
        return {
            // We grab the line number of the first target file sync-start
            // tag for this markerID and return that as the target line.
            // This will allow us to identify the target content in our
            // messaging to the user.
            line: matchingTargets[0][0],
            checksum: targetMarker.checksum,
        };
    };

    const fileInfo = cache[file];
    if (fileInfo.error != null) {
        // This means the file couldn't be parse.
        // So we'll log this error and skip on.
        log.error(fileInfo.error.message);
        return;
    }

    const {markers, aliases} = fileInfo;
    for (const markerID of Object.keys(markers)) {
        const sourceMarker = markers[markerID];
        if (!sourceMarker.fixable) {
            // If this marker isn't one that can be fixed, we don't care
            // if it is a violation or not; it was only loaded for reference
            // as a target of a fixable marker.
            continue;
        }
        reportErrors(log, sourceMarker.errors);

        const targetLines = Object.keys(sourceMarker.targets).map((line) =>
            parseInt(line),
        );

        /**
         * Here we iterate all the targets (the sync-start tags) in the source
         * file and then try to map them to the target marker they reference.
         */
        for (const sourceLine of targetLines) {
            const targetRef = sourceMarker.targets[sourceLine];
            const targetInfo: ?FileInfo = cache[targetRef.file];
            const targetMarker: ?Marker = targetInfo?.markers[markerID];

            const targetDetails = getTargetDetail(targetMarker, aliases);

            const errors = [];
            if (targetRef.error) {
                errors.push(targetRef.error);
            }
            if (sourceMarker !== targetMarker && targetMarker?.errors) {
                errors.push(...targetMarker.errors);
            }

            const sourceChecksum = targetRef.checksum;
            const targetChecksum = targetDetails?.checksum;
            if (sourceChecksum === targetChecksum && errors.length === 0) {
                // If the checksum matches and we have no errors, we can skip
                // this edge.
                continue;
            }

            if (targetDetails?.line == null || targetChecksum == null) {
                errors.push({
                    message: `No return tag named '${markerID}' in '${Format.cwdFilePath(
                        targetRef.file,
                    )}'`,
                    code: "no-return-tag",
                    line: sourceLine,
                });
            }

            const normalizedTargetFile = targetRef.file.replace(
                new RegExp(escapeRegExp(path.sep), "g"),
                "/",
            );
            reportErrors(log, errors);

            yield {
                errors,
                markerID,
                sourceLine,
                sourceChecksum,
                sourceCommentStart: sourceMarker.commentStart,
                sourceCommentEnd: sourceMarker.commentEnd,
                sourceDeclaration: targetRef.declaration,
                targetFile: normalizedTargetFile,
                targetLine: targetDetails?.line,
                targetChecksum,
            };
        }
    }
}
