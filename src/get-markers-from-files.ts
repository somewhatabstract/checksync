/**
 * Cache in which we store our knowledge of existing markers.
 */
import fs from "fs";
import parseFile from "./parse-file";

import {FileInfo, MarkerCache, Options} from "./types";
import * as Errors from "./errors";

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
    files: ReadonlyArray<string>,
): Promise<MarkerCache> {
    const cacheData: MarkerCache = {};
    const referencedFiles: Array<string> = [];

    const setCacheData = (file: string, info: FileInfo) => {
        cacheData[file] = info;
        info.aliases.push(file);
    };

    const cacheFiles = async (
        files: ReadonlyArray<string>,
        readOnly: boolean,
    ) => {
        for (const file of files) {
            let realFilePath;
            try {
                // This could be a symlink.
                // We want to treat it as the canonical real file.
                realFilePath = fs.realpathSync(file);

                // We don't need to parse things twice.
                if (cacheData[realFilePath] === undefined) {
                    // OK, it hasn't been parsed yet. We need to parse it so we
                    // can store a copy for our symlink.
                    const parseResult = await parseFile(
                        options,
                        realFilePath,
                        readOnly,
                    );
                    setCacheData(realFilePath, {
                        readOnly,
                        markers: parseResult.markers || {},
                        aliases: [],
                        errors: parseResult.errors,
                        lineCount: parseResult.lineCount,
                    });
                    referencedFiles.push(...parseResult.referencedFiles);
                }
            } catch (e: any) {
                // If we got an issue, then we need to store this as could
                // not parse (as well as record the unfixable alias)
                setCacheData(file, {
                    readOnly,
                    markers: {},
                    aliases: [],
                    errors: [Errors.couldNotParse(file, e.message)],
                });
            }

            // If the original file was a symlink, let's make sure we
            // store the markers (or the error) under its filepath too.
            if (realFilePath && realFilePath !== file) {
                // Close as unfixable, since this file already exists in
                // its potentially fixable version, and we don't need to fix
                // it twice.
                setCacheData(file, {
                    ...(cacheData[realFilePath] ?? {}),
                    readOnly: true,
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
