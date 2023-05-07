import getMarkersFromFiles from "./get-markers-from-files";
import getFiles from "./get-files";
import ExitCodes, {ExitCode} from "./exit-codes";
import processCache from "./process-cache";

import {ILog, Options} from "./types";

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
): Promise<ExitCode> {
    if (options.autoFix && options.dryRun) {
        log.info("DRY-RUN: Files will not be modified");
    }

    const {includeGlobs, excludeGlobs, ignoreFiles} = options;
    const files = await getFiles(includeGlobs, excludeGlobs, ignoreFiles, log);

    if (files.length === 0) {
        log.error("No matching files");
        return ExitCodes.NO_FILES;
    }

    const cache = await getMarkersFromFiles(options, files);
    const result = processCache(options, cache, log);
    return result;
}
