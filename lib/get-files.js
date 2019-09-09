// @flow
import fs from "fs";
import util from "util";
import glob from "glob";

import flatten from "lodash/flatten";
import sortedUniq from "lodash/sortedUniq";

import type {Options} from "glob";

const globAsync: (
    pattern: string,
    options?: Options,
) => Promise<string[]> = util.promisify(glob);

/**
 * Expand the given globs into files.
 *
 * @param {string[]} globs The globs to expand. If empty or falsy, this defaults
 * to the current working directory.
 */
export default function getFiles(globs: Array<string>): Promise<Array<string>> {
    globs = globs && globs.length ? globs : [process.cwd()];

    const promisedGlobs = globs
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
