import fs from "fs/promises";
import {ILog, MarkerCache} from "./types";
import {ExitError} from "./exit-error";
import {ExitCode} from "./exit-codes";
import path from "path";

/**
 * Load a marker cache from a file.
 *
 * @param filepath The path to the cache file.
 * @param log A logger for outputting errors and the like.
 * @returns A promise of a marker cache.
 * @throws ExitError if the cache file cannot be read or parsed.
 */
export const loadCache = async (
    filepath: string,
    log: ILog,
): Promise<MarkerCache> => {
    const absCachePath = path.isAbsolute(filepath)
        ? filepath
        : path.join(process.cwd(), filepath);
    try {
        log.info(`Loading cache from ${absCachePath}`);
        const cacheRaw = await fs.readFile(absCachePath, "utf8");
        return JSON.parse(cacheRaw);
    } catch (error) {
        throw new ExitError(
            `Failed to load cache from ${absCachePath}`,
            ExitCode.BAD_CACHE,
            {
                cause: error,
            },
        );
    }
};
