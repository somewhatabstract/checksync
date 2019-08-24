// @flow
/**
 * The main implementation for this tool.
 */
import fs from "fs";
import util from "util";
import glob from "glob";
import _ from "lodash";

import logging from "./logging.js";
import MarkerCache from "./marker-cache.js";

const globAsync = util.promisify(glob);

/**
 * Expand the given globs into files.
 *
 * @param {string[]} globs The globs to expand. If empty or falsy, this defaults
 * to the current working directory.
 */
const getFiles = (globs: Array<string>): Promise<Array<string>> => {
    globs = globs && globs.length ? globs : [process.cwd()];

    const promisedGlobs = globs
        // If we have a dir, let's make that a be everything under that dir.
        .map(pattern =>
            fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()
                ? `${pattern}/**`
                : pattern
        )
        // Now let's match the patterns and see what files we get.
        .map(pattern =>
            globAsync(pattern, { nodir: true, absolute: true, nosort: true })
        );

    return Promise.all(promisedGlobs).then(results =>
        _.chain(results)
            .flatten()
            .sort()
            .sortedUniq()
            .value()
    );
};

/**
 * Check the sync marks for the files represented by the given globs.
 *
 * @param {string[]} globs The globs that identify which files to check.
 * @param {boolean} autoFix When true, any out-of-date sync markers will be
 * updated.
 */
export const checkSync = async (globs: Array<string>, autoFix: boolean) => {
    const files = await getFiles(globs);

    if (files.length === 0) {
        logging.error("No matching files");
    }

    const cache = await MarkerCache.fromFiles(files);
    logging.info(`CACHE: ${JSON.stringify(cache)}`);
};
