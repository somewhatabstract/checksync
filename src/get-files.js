// @flow
import glob from "fast-glob";
import path from "path";
import ignoreFilesToExcludeGlobs from "./ignore-files-to-exclude-globs.js";

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
    excludeGlobs: Array<string>,
    ignoreFiles: Array<string>,
    log?: ILog,
): Promise<Array<string>> {
    const ignoreFileGlobs = ignoreFilesToExcludeGlobs(ignoreFiles);
    const allExcludeGlobs = new Set([...excludeGlobs, ...ignoreFileGlobs]);

    log?.verbose(
        () => `Include globs: ${JSON.stringify(includeGlobs, null, "    ")}`,
    );
    log?.verbose(
        () => `Exclude globs: ${JSON.stringify(allExcludeGlobs, null, "    ")}`,
    );

    // Now let's match the patterns and see what files we get.
    const paths = await glob(includeGlobs, {
        onlyFiles: true,
        absolute: true,
        ignore: Array.from(allExcludeGlobs),
    });
    const sortedPaths = paths
        .map((p) => p.replace(new RegExp("/", "g"), path.sep))
        .sort();
    log?.verbose(
        () => `Discovered paths: ${JSON.stringify(sortedPaths, null, "    ")}`,
    );
    return sortedPaths;
}
