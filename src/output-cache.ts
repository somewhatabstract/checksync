import fs from "fs/promises";
import {ExitCode} from "./exit-codes";
import {ILog, MarkerCache, Options} from "./types";
import path from "path";

/**
 * Write the cache to the output file or to the console.
 *
 * @param options The options for this run.
 * @param cache The cache to write.
 * @param log A logger for outputting errors and the like.
 * @returns The promise of an error code.
 * @throws ExitError if the cache file cannot be written.
 */
export const outputCache = async (
    options: Options,
    cache: MarkerCache,
    log: ILog,
): Promise<ExitCode> => {
    try {
        const cacheRaw = JSON.stringify(cache);
        if (options.json) {
            log.log(cacheRaw);
        } else {
            const absCachePath = path.isAbsolute(options.cachePath)
                ? options.cachePath
                : path.join(process.cwd(), options.cachePath);
            await fs.writeFile(absCachePath, cacheRaw, "utf8");
            log.info(`Cache written to ${absCachePath}`);
        }
        return ExitCode.SUCCESS;
    } catch (error) {
        log.error("Unable to output cache");
        return ExitCode.CATASTROPHIC;
    }
};
