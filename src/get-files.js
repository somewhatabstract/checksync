// @flow
import fs from "fs";
import glob from "fast-glob";

import uniq from "lodash/uniq";

async function getFilesForGlobs(
    includeGlobs: Array<string>,
    excludeGlobs: Array<string>,
): Promise<Array<string>> {
    const patterns = uniq(includeGlobs)
        // If we have a dir, let's make that a be everything under that dir.
        .map((pattern: string) =>
            fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()
                ? `${pattern}/**`
                : pattern,
        );

    // Now let's match the patterns and see what files we get.
    const paths = await glob(patterns, {
        onlyFiles: true,
        absolute: true,
        ignore: excludeGlobs,
    });
    return paths.sort();
}

/**
 * Expand the given globs into files.
 *
 * @param {string[]} globs The globs to expand.
 */
export default async function getFiles(
    includeGlobs: Array<string>,
    excludeGlobs: Array<string>,
): Promise<Array<string>> {
    return await getFilesForGlobs(includeGlobs, excludeGlobs);
}
