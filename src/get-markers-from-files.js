// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */
import fs from "fs";
import parseFile from "./parse-file.js";

import type {FileInfo, MarkerCache, Options} from "./types.js";

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
): Promise<MarkerCache> {
    const cacheData: MarkerCache = {};
    const referencedFiles: Array<string> = [];

    const setCacheData = (file: string, info: FileInfo) => {
        cacheData[file] = info;
        info.aliases.push(file);
    };

    const cacheFiles = async (files: Array<string>, readOnly: boolean) => {
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
                    setCacheData(file, {
                        ...cacheData[realFilePath],
                        readOnly: true,
                    });
                    continue;
                }

                const parseResult = await parseFile(options, file, readOnly);
                setCacheData(file, {
                    readOnly,
                    markers: parseResult.markers || {},
                    aliases: [],
                    errors: parseResult.errors,
                    lineCount: parseResult.lineCount,
                });
                referencedFiles.push(...parseResult.referencedFiles);

                // Since this might be a symlink source, let's make sure we store the
                // markers under its target filepath too.
                if (realFilePath !== file) {
                    // Close as unfixable, since this file already exists in
                    // a fixable version, and we don't need to fix it twice.
                    setCacheData(realFilePath, {
                        ...cacheData[file],
                        readOnly: true,
                    });
                }
            } catch (e) {
                setCacheData(file, {
                    readOnly,
                    markers: {},
                    aliases: [],
                    errors: [
                        {
                            code: "could-not-parse",
                            reason: `Could not parse ${file}: ${e.message}`,
                        },
                    ],
                });
            }
        }
    };

    // Process the main file set. These are considered "fixable" as they
    // are the files that our user requested be processed directly so we
    // pass readOnly as false.
    await cacheFiles(files, false);

    /**
     * In this second pass, we load the files that were referenced by the
     * files we just processed and capture their markers.
     */
    await cacheFiles(referencedFiles, true);

    return cacheData;
}
