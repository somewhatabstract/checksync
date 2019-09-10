// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */
import path from "path";
import uniq from "lodash/uniq";
import parseFile from "./parse-file.js";

import type {ILog, MarkerCache} from "./types.js";

/**
 * Generate a marker cache from the given files.
 *
 * @export
 * @param {Array<string>} files The files to be loaded.
 * @returns {Promise<MarkerCache>} A marker cache.
 */
export default async function getMarkersFromFiles(
    files: Array<string>,
    comments: Array<string>,
    log: ILog,
): Promise<MarkerCache> {
    const cacheData: MarkerCache = ({}: any);
    const referencedFiles: Array<string> = [];
    const logFileRef = (file, fileRef) => {
        const normalizedFileRef = path.resolve(path.dirname(file), fileRef);
        referencedFiles.push(normalizedFileRef);
        return normalizedFileRef;
    };

    for (const file of files) {
        const fileMarkers = await parseFile(
            file,
            true,
            comments,
            log,
            fileRef => logFileRef(file, fileRef),
        );
        cacheData[file] = fileMarkers || {};
    }

    /**
     * In this second pass, we load the files that are not in the original
     * set, and capture their markers. We don't care about going any level
     * deeper (though perhaps repeating till all referenced files are
     * loaded would be a mode folks might want).
     */
    for (const fileRef of uniq(referencedFiles)) {
        if (cacheData[fileRef] != null) {
            continue;
        }

        const fileMarkers = await parseFile(fileRef, false, comments, log);
        cacheData[fileRef] = fileMarkers || {};
    }

    return cacheData;
}
