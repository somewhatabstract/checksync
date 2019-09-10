// @flow
import fixViolation from "./fix-violation.js";
import reportViolation from "./report-violation.js";

import type {MarkerCache, ILog} from "./types";

export default function handleViolations(
    cache: MarkerCache,
    autoFix: boolean,
    log: ILog,
): Array<string> {
    const violationHandler = autoFix ? fixViolation : reportViolation;

    const violationFiles = {};
    for (const file of Object.keys(cache)) {
        const markers = cache[file];
        if (markers == null) {
            // This means a target reference that couldn't be found and we can
            // totally ignore it at this level.
            continue;
        }

        for (const markerID of Object.keys(markers)) {
            const marker = markers[markerID];
            if (!marker.fixable) {
                // If this marker isn't one that can be fixed, we don't care
                // if it is a violation or not; it was only loaded for reference
                // as a target of a fixable marker.
                continue;
            }

            for (const line of Object.keys(marker.targets)) {
                const lineNumber = parseInt(line);
                const targetRef = marker.targets[lineNumber];

                const target = cache[targetRef.file];
                if (target == null) {
                    // Target doesn't exist if we get null.
                    // We already indicated this error elsewhere, so just skip
                    // along.
                    continue;
                }
                const targetMarker = target[markerID];
                if (targetMarker.checksum !== marker.checksum) {
                    violationFiles[file] = true;
                    violationHandler(
                        file,
                        lineNumber,
                        targetRef.file,
                        markerID,
                        targetMarker.checksum,
                        marker.fixable,
                        log,
                    );
                }
            }
        }
    }
    return Object.keys(violationFiles);
}
