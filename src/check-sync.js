// @flow
import getMarkersFromFiles from "./get-markers-from-files.js";
import getFiles from "./get-files.js";
import ErrorCodes from "./error-codes.js";
import processCache from "./process-cache.js";

import type {ILog} from "./types.js";
import type {ErrorCode} from "./error-codes.js";

/**
 *
 * Check the sync marks for the files represented by the given globs.
 *
 * @export
 * @param {Array<string>} globs The globs that identify which files to check.
 * @param {boolean} autoFix When true, any out-of-date sync markers will be
 * updated.
 * @param {Array<string>} comments The strings that represent the start of
 * lines where sync-start and sync-end tags can be found.
 * @param {ILog} log A logger for outputting errors and the like.
 * @returns {Promise<ErrorCode>} The promise of an error code
 */
export default async function checkSync(
    globs: Array<string>,
    autoFix: boolean,
    comments: Array<string>,
    log: ILog,
): Promise<ErrorCode> {
    const files = await getFiles(globs);

    if (files.length === 0) {
        log.error("No matching files");
        return ErrorCodes.NO_FILES;
    }

    const cache = await getMarkersFromFiles(files, comments, log);

    if (log.errorsLogged && autoFix) {
        log.log(
            "\n🛑  Aborting tag updates due to parsing errors. Fix these errors and try again.",
        );
        return ErrorCodes.PARSE_ERRORS;
    }

    return processCache(cache, autoFix, log);
}
