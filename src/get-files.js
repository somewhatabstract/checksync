// @flow
import glob from "fast-glob";
import path from "path";
import ignoreFileGlobsToExcludeGlobs from "./ignore-file-globs-to-exclude-globs.js";

import type {ILog} from "./types.js";

/**
 * Expand the given globs and ignore files into a list of files.
 *
 * @param {Array<string>} includeGlobs The include globs to expand.
 * @param {Array<string>} excludeGlobs The exclude globs to expand.
 * @param {Array<string>} ignoreFiles The ignore files to expand.
 * @param {ILog} log A log to record things
 */
export default async function getFiles(
    includeGlobs: Array<string>,
    explicitExcludeGlobs: Array<string>,
    ignoreFileGlobs: Array<string>,
    log?: ILog,
): Promise<Array<string>> {
    const ignoreFileExcludeGlobs = await ignoreFileGlobsToExcludeGlobs(
        ignoreFileGlobs,
    );
    const allExcludeGlobs = Array.from(
        new Set([...explicitExcludeGlobs, ...ignoreFileExcludeGlobs]),
    );

    log?.verbose(
        () => `Include globs: ${JSON.stringify(includeGlobs, null, 4)}`,
    );
    log?.verbose(
        () => `Exclude globs: ${JSON.stringify(allExcludeGlobs, null, 4)}`,
    );

    // Now let's match the patterns and see what files we get.
    const paths = await glob(includeGlobs, {
        onlyFiles: true,
        absolute: true,
        ignore: allExcludeGlobs,
    });
    const sortedPaths = paths
        .map((p) => p.replace(new RegExp("/", "g"), path.sep))
        .sort();
    log?.verbose(
        () => `Discovered paths: ${JSON.stringify(sortedPaths, null, 4)}`,
    );
    return sortedPaths;
}
