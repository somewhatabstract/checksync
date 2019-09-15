// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */
import fs from "fs";
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
    const cacheData: MarkerCache = {};
    const referencedFiles: Array<string> = [];
    const logFileRef = (file, fileRef) => {
        // TODO: This is currently treating target file as source file relative
        // but according to Khan Academy sync-linter, it should be relative to
        // the project root. So, we need a way to determine what project root is
        // Can we assume it's the locaton of the node_modules folder that checksync
        // is installed in? No, because it could be installed globally.
        // We can't assume github. What about package.json?
        // Let's default to package.json folder and provide way to override it
        // via our arguments.

        const normalizedFileRef = path.resolve(path.dirname(file), fileRef);
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
            comments,
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

        const fileMarkers = await parseFile(fileRef, false, comments, log);
        cacheData[fileRef] = fileMarkers;
    }

    return cacheData;
}
