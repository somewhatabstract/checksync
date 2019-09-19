// @flow
import getMarkersFromFiles from "./get-markers-from-files.js";
import getFiles from "./get-files.js";
import ErrorCodes from "./error-codes.js";
import processCache from "./process-cache.js";

import type {ILog, Options} from "./types.js";
import type {ErrorCode} from "./error-codes.js";

/**
 *
 * Check the sync marks for the files represented by the given globs.
 *
 * @export
 * @param {Options} options The options for this run
 * @param {ILog} log A logger for outputting errors and the like.
 * @returns {Promise<ErrorCode>} The promise of an error code
 */
export default async function checkSync(
    options: Options,
    log: ILog,
): Promise<ErrorCode> {
    if (options.autoFix && options.dryRun) {
        log.info("DRY-RUN: Files will not be written");
    }
    const {includeGlobs, excludeGlobs, autoFix} = options;
    const files = await getFiles(includeGlobs, excludeGlobs);

    if (files.length === 0) {
        log.error("No matching files");
        return ErrorCodes.NO_FILES;
    }

    const cache = await getMarkersFromFiles(options, files, log);

    if (log.errorsLogged && autoFix) {
        log.log("");
        log.log(
            "🛑  Aborting tag updates due to parsing errors. Fix these errors and try again.",
        );
        return ErrorCodes.PARSE_ERRORS;
    }

    return processCache(options, cache, log);
}
