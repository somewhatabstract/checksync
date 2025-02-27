import {ExitCode} from "./exit-codes";
import processCache from "./process-cache";

import {ILog, Options} from "./types";
import buildCache from "./build-cache";
import {loadCache} from "./load-cache";
import {ExitError} from "./exit-error";
import {outputCache} from "./output-cache";

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
    // If the cacheMode is ignore, we just process the files normally.
    // If the cacheMode is write, then we build the cache but we don't
    // process it.
    // If the cacheMode is read, then we read the cache and process that.
    if (options.cacheMode !== "write" && options.autoFix && options.dryRun) {
        log.info("DRY-RUN: Files will not be modified");
    }

    try {
        const cache =
            options.cacheMode === "read"
                ? await loadCache(options.cachePath, log)
                : await buildCache(options, log);

        if (options.cacheMode === "write") {
            return outputCache(options, cache, log);
        }
        return processCache(options, cache, log);
    } catch (error) {
        if (error instanceof ExitError) {
            if (error.exitCode === ExitCode.BAD_CACHE) {
                log.error("Unable to load cache");
                return ExitCode.BAD_CACHE;
            }
            if (error.exitCode === ExitCode.NO_FILES) {
                log.error("No files found");
                return ExitCode.NO_FILES;
            }
        }
        log.error("Unexpected catastrophic error");
        return ExitCode.CATASTROPHIC;
    }
}
