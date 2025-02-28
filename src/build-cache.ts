import getMarkersFromFiles from "./get-markers-from-files";
import getFiles from "./get-files";

import {ILog, MarkerCache, Options} from "./types";
import {ExitCode} from "./exit-codes";
import {ExitError} from "./exit-error";

/**
 * Build a marker cache by parsing the files identified in options.
 *
 * @export
 * @param options The options for this run
 * @param log A logger for outputting errors and the like.
 * @returns The promise of a marker cache.
 * @throws ExitError if no files are found.
 */
export default async function buildCache(
    options: Options,
    log: ILog,
): Promise<MarkerCache> {
    const {includeGlobs, excludeGlobs, ignoreFiles} = options;
    const files = await getFiles(includeGlobs, excludeGlobs, ignoreFiles, log);

    if (files.length === 0) {
        throw new ExitError("No matching files", ExitCode.NO_FILES);
    }

    return getMarkersFromFiles(options, files);
}
