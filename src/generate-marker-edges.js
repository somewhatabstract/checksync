// @flow
import Format from "./format.js";
import cwdRelativePath from "./cwd-relative-path.js";

import type {FileInfo, ILog, Marker, MarkerCache} from "./types.js";

export type MarkerEdge = {
    /**
     * The marker identifier.
     */
    +markerID: string,

    /**
     * The line in the source file where the marker is declared.
     */
    +sourceLine: string,

    /**
     * The checksum that the source file has recorded for the target content.
     */
    +sourceChecksum: string,

    /**
     * The full tag declaration of the marker target in the source file.
     */
    +sourceDeclaration: string,

    /**
     * The comment style that the source file uses.
     */
    +sourceComment: string,

    /**
     * The path to the target file of the marker.
     */
    +targetFile: string,

    /**
     * The line in the target file where the marker begins.
     */
    +targetLine: string,

    /**
     * The actual checksum of the target content.
     */
    +targetChecksum: string,
};

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
    log: ILog,
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
    if (fileInfo == null) {
        // This means a target reference that couldn't be found and we can
        // totally ignore it at this level.
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

        /**
         * Here we iterate all the targets (the sync-start tags) in the source
         * file and then try to map them to the target marker they reference.
         */
        for (const sourceLine of Object.keys(sourceMarker.targets)) {
            const targetRef = sourceMarker.targets[sourceLine];
            const targetInfo: ?FileInfo = cache[targetRef.file];
            const targetMarker: ?Marker =
                targetInfo && targetInfo.markers[markerID];

            const targetDetails = getTargetDetail(targetMarker, aliases);
            if (targetDetails == null) {
                // If we got no details, then either the target file is not in
                // the cache, does not contain the marker, or does not have
                // a marker that points back to our source file, so we need
                // to report that.
                log.error(
                    `${Format.cwdFilePath(
                        targetRef.file,
                    )} does not contain a tag named '${markerID}' that points to '${cwdRelativePath(
                        file,
                    )}'`,
                );
                continue;
            }

            const sourceChecksum = targetRef.checksum;
            const targetChecksum = targetDetails.checksum;
            if (sourceChecksum === targetChecksum) {
                // If the checksum matches, we can skip this edge.
                continue;
            }

            yield {
                markerID,
                sourceLine,
                sourceChecksum,
                sourceComment: sourceMarker.comment,
                sourceDeclaration: targetRef.declaration,
                targetFile: targetRef.file,
                targetLine: targetDetails.line,
                targetChecksum,
            };
        }
    }
}
