// @flow
import getMarkersFromFiles from "./get-markers-from-files.js";
import getFiles from "./get-files.js";
import violationFixer from "./violation-fixer.js";
import violationReporter from "./violation-reporter.js";

import type {ILog} from "./types.js";

/**
 * Check the sync marks for the files represented by the given globs.
 *
 * @param {string[]} globs The globs that identify which files to check.
 * @param {boolean} autoFix When true, any out-of-date sync markers will be
 * updated.
 */
export default async function checkSync(
    globs: Array<string>,
    autoFix: boolean,
    comments: Array<string>,
    log: ILog,
): Promise<void> {
    const files = await getFiles(globs);

    if (files.length === 0) {
        log.error("No matching files");
        return;
    }

    const cache = await getMarkersFromFiles(files, comments, log);

    if (log.errorsLogged) {
        log.error("Aborting due to errors");
        return;
    }

    const violationHandler = autoFix ? violationFixer : violationReporter;

    // TODO:
    //   1. Iterate the files that have markers and are marked fixable
    //   2. Compare their target checksums with the actual targets checksum
    //   3. Request that any mismatches are processed by our processors
    for (const file of Object.keys(cache)) {
        const markers = cache[file];
        for (const markerID of Object.keys(markers)) {
            const marker = markers[markerID];
            for (const line of Object.keys(marker.targets)) {
                const lineNumber = parseInt(line);
                const targetRef = marker.targets[lineNumber];
                const targetMarker = cache[targetRef.file][markerID];

                if (targetMarker.checksum !== marker.checksum) {
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
}
