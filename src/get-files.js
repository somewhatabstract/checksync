// @flow
import glob from "fast-glob";
import path from "path";

import type {ILog} from "./types.js";

/**
 * Expand the given globs into files.
 *
 * @param {Array<string>} includeGlobs The include globs to expand.
 * @param {Array<string>} excludeGlobs The exclude globs to expand.
 * @param {ILog} log A log to record things
 */
export default async function getFiles(
    includeGlobs: Array<string>,
    excludeGlobs: Array<string>,
    log: ILog,
): Promise<Array<string>> {
    log.verbose(
        () => `Include globs: ${JSON.stringify(includeGlobs, null, "    ")}`,
    );
    log.verbose(
        () => `Exclude globs: ${JSON.stringify(excludeGlobs, null, "    ")}`,
    );

    // Now let's match the patterns and see what files we get.
    const paths = await glob(includeGlobs, {
        onlyFiles: true,
        absolute: true,
        ignore: excludeGlobs,
    });
    const sortedPaths = paths
        .map((p) => p.replace(new RegExp("/", "g"), path.sep))
        .sort();
    log.verbose(
        () => `Discovered paths: ${JSON.stringify(sortedPaths, null, "    ")}`,
    );
    return sortedPaths;
}
