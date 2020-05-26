// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */
import fs from "fs";
import parseFile from "./parse-file.js";
import cloneAsUnfixable from "./clone-as-unfixable.js";
import Format from "./format.js";

import type {ILog, FileInfo, MarkerCache, Options} from "./types.js";

/**
 * Generate a marker cache from the given files.
 *
 * @export
 * @param {Options} options
 * @param {Array<string>} files The files to be loaded.
 * @returns {Promise<MarkerCache>} A marker cache.
 */
export default async function getMarkersFromFiles(
    options: Options,
    files: Array<string>,
    log: ILog,
): Promise<MarkerCache> {
    const cacheData: MarkerCache = {};
    const referencedFiles: Array<string> = [];

    const setCacheData = (file: string, info: ?FileInfo) => {
        cacheData[file] = info;
        if (info != null) {
            info.aliases.push(file);
        }
    };

    const cacheFiles = async (files: Array<string>, fixable: boolean) => {
        for (const file of files) {
            if (cacheData[file] !== undefined) {
                continue;
            }

            // This file might be a symlink source or target, so before we parse it,
            // let's see if we already did.
            try {
                const realFilePath = fs.realpathSync(file);
                if (
                    realFilePath !== file &&
                    cacheData[realFilePath] !== undefined
                ) {
                    // Clone as unfixable, since this file already exists in
                    // a fixable version, and we don't need to fix it twice.
                    setCacheData(
                        file,
                        cloneAsUnfixable(cacheData[realFilePath]),
                    );
                    continue;
                }

                const parseResult = await parseFile(
                    options,
                    file,
                    fixable,
                    log,
                );
                setCacheData(
                    file,
                    parseResult.markers
                        ? {
                              markers: parseResult.markers,
                              aliases: [],
                          }
                        : null,
                );
                referencedFiles.push(...parseResult.referencedFiles);

                // Since this might be a symlink source, let's make sure we store the
                // markers under its target filepath too.
                if (realFilePath !== file) {
                    // Close as unfixable, since this file already exists in
                    // a fixable version, and we don't need to fix it twice.
                    setCacheData(
                        realFilePath,
                        cloneAsUnfixable(cacheData[file]),
                    );
                }
            } catch (e) {
                log.error(`Cannot parse file: ${Format.cwdFilePath(file)}`);
            }
        }
    };

    // Process the main file set. These are considered "fixable" as they
    // are the files that our user requested be processed directly.
    await cacheFiles(files, true);

    /**
     * In this second pass, we load the files that are not in the original
     * set, and capture their markers. We don't care about going any level
     * deeper (though perhaps repeating till all referenced files are
     * loaded would be a mode folks might want).
     */
    await cacheFiles(referencedFiles, false);

    return cacheData;
}
