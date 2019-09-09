// @flow
import {ConsoleLogger as Logging} from "./logging.js";
import {fromFiles} from "./marker-cache.js";
import getFiles from "./get-files.js";

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
): Promise<void> {
    const files = await getFiles(globs);

    if (files.length === 0) {
        Logging.error("No matching files");
    }

    const cache = await fromFiles(files, comments, Logging);

    // TEMP - remove this.
    Logging.info(`CACHE: ${JSON.stringify(cache)}`);

    // TODO: Track logging for errors so we can abort
    // TODO: Pass the cache to verification/fix methods accordingly.

    // TODO: Fixing must be from the bottom of the file up so that line numbers
    //       don't change on us

    // TODO: Can we sync a marker within the same file? Not really since there could be multiple;
    //       how would we manage that? Let's ban it.

    // TODO: Run fixes or output errors.
}
