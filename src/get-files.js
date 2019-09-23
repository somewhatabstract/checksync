// @flow
import fs from "fs";
import util from "util";
import glob from "glob";
import {Minimatch} from "minimatch";

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
        .map((pattern: string) =>
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

const removeIgnoredFiles = (
    files: Array<string>,
    excludeGlobs: Array<string>,
): Array<string> => {
    // Since the matchers are going to be applied repeatedly, let's build
    // minimatch instances and reuse them.
    const matchers = uniq(excludeGlobs).map(glob => new Minimatch(glob));
    return files.filter(file => matchers.every(m => !m.match(file)));
};

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
    return removeIgnoredFiles(includeFiles, excludeGlobs);
}
