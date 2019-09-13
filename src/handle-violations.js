// @flow
import fixViolation from "./fix-violation.js";
import reportViolation from "./report-violation.js";
import cwdRelativePath from "./cwd-relative-path.js";

import type {MarkerCache, ILog, Target} from "./types";

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
                const targetMarker = target && target[markerID];
                if (
                    targetMarker == null ||
                    !Object.values(targetMarker.targets).some(
                        (t: any) => (t: Target).file === file,
                    )
                ) {
                    log.error(
                        `${cwdRelativePath(
                            targetRef.file,
                        )} does not contain a tag named '${markerID}' that points to '${cwdRelativePath(
                            file,
                        )}'`,
                    );
                    continue;
                }

                // Now compare the actual target marker checksum with the one
                // in our reference, and if they don't match, do something
                // about it.
                if (targetMarker.checksum !== targetRef.checksum) {
                    violationFiles[file] = true;
                    violationHandler(
                        file,
                        lineNumber,
                        markerID,
                        targetRef.checksum,
                        targetRef.file,
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
