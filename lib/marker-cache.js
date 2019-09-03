// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */

import _ from "lodash";
import parseFile from "./file-parser.js";

import type {ILog, MarkerCache} from "./types.js";

/**
 * Generate a marker cache from the given files.
 *
 * @export
 * @param {Array<string>} files The files to be loaded.
 * @returns {Promise<MarkerCache>} A marker cache.
 */
export async function fromFiles(
    files: Array<string>,
    comments: Array<string>,
    log: ILog,
): Promise<MarkerCache> {
    const cacheData: MarkerCache = ({}: any);
    const referencedFiles: Array<string> = [];
    const logFileRef = fileRef => referencedFiles.push(fileRef);

    for (const file of files) {
        cacheData[file] = await parseFile(
            file,
            true,
            comments,
            log,
            logFileRef,
        );
    }

    /**
     * In this second pass, we load the files that are not in the original
     * set, and capture their markers. We don't care about going any level
     * deeper (though perhaps repeating till all referenced files are
     * loaded would be a mode folks might want).
     */
    for (const fileRef of _.uniq(referencedFiles)) {
        if (cacheData[fileRef]) {
            continue;
        }
        cacheData[fileRef] = await parseFile(fileRef, false, comments, log);
    }

    return cacheData;
}
