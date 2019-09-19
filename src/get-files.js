// @flow
import fs from "fs";
import util from "util";
import glob from "glob";

import flatten from "lodash/flatten";
import sortedUniq from "lodash/sortedUniq";
import uniq from "lodash/uniq";

import type {Options} from "glob";

const globAsync: (
    pattern: string,
    options?: Options,
) => Promise<string[]> = util.promisify(glob);

function getFilesForGlobs(globs: Array<string>): Promise<Array<string>> {
    const promisedGlobs = uniq(globs)
        // If we have a dir, let's make that a be everything under that dir.
        .map(pattern =>
            fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()
                ? `${pattern}/**`
                : pattern,
        )
        // Now let's match the patterns and see what files we get.
        .map((pattern: string) =>
            globAsync(pattern, {nodir: true, absolute: true, nosort: true}),
        );

    return Promise.all(promisedGlobs).then((results: Array<Array<string>>) =>
        sortedUniq(flatten(results).sort()),
    );
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
    const includeFiles = await getFilesForGlobs(includeGlobs);
    const excludeFiles = await getFilesForGlobs(excludeGlobs);

    return includeFiles.filter(i => !excludeFiles.includes(i));
}
