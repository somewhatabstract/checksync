// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */
import fs from "fs";
import path from "path";
import uniq from "lodash/uniq";
import parseFile from "./parse-file.js";
import ancesdir from "ancesdir";

import type {ILog, MarkerCache, Options} from "./types.js";

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
    const logFileRef = (file, fileRef) => {
        // Target paths are relative to the root location.
        const rootPath = ancesdir(file, options.rootMarker);
        const normalizedFileRef = path.normalize(path.join(rootPath, fileRef));
        const exists =
            fs.existsSync(normalizedFileRef) &&
            fs.lstatSync(normalizedFileRef).isFile();
        if (exists) {
            referencedFiles.push(normalizedFileRef);
        }
        return {file: normalizedFileRef, exists};
    };

    // TODO(somewhatabstract): Use jest-worker and farm parsing out to
    // multiple threads.

    for (const file of files) {
        const fileMarkers = await parseFile(
            file,
            true,
            options.comments,
            log,
            fileRef => logFileRef(file, fileRef),
        );
        cacheData[file] = fileMarkers;
    }

    /**
     * In this second pass, we load the files that are not in the original
     * set, and capture their markers. We don't care about going any level
     * deeper (though perhaps repeating till all referenced files are
     * loaded would be a mode folks might want).
     */
    for (const fileRef of uniq(referencedFiles)) {
        if (cacheData[fileRef] !== undefined) {
            continue;
        }

        const fileMarkers = await parseFile(
            fileRef,
            false,
            options.comments,
            log,
        );
        cacheData[fileRef] = fileMarkers;
    }

    return cacheData;
}
