// @flow
import getMarkersFromFiles from "./get-markers-from-files.js";
import getFiles from "./get-files.js";
import processFix from "./process-fix.js";
import processState from "./process-state.js";

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

    // TODO(somewhatabstract): Should we pre-process the cache to remove
    // things that aren't at error? Perhaps only if we're doing some sort
    // of caching/watching.
    const processor = autoFix ? processFix : processState;
    processor(cache, log);
}
