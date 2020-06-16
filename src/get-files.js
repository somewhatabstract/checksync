// @flow
import glob from "fast-glob";
import path from "path";

import type {ILog} from "./types.js";

/**
 * Following gitignore format https://git-scm.com/docs/gitignore#_pattern_format
 *
 * /foo  Ignore root (not sub) file and dir and its paths underneath.     /foo, /foo/**
 * /foo/ Ignore root (not sub) foo dir and its paths underneath.          /foo/**
 * foo   Ignore (root/sub) foo files and dirs and their paths underneath. foo, ** /foo/**
 * foo/  Ignore (root/sub) foo dirs and their paths underneath.	          ** /foo/**
 */
function* turnIgnoresToGlobs(globs: Array<string>): Iterator<string> {
    const normalizeSeparators = (g: string): string =>
        g.split(path.sep).join("/");
    for (const glob of globs) {
        if (glob.startsWith("/")) {
            yield normalizeSeparators(path.join(glob, "**"));
            if (!glob.endsWith("/")) {
                yield glob;
            }
        } else {
            yield normalizeSeparators(path.join("**", glob, "**"));
            if (!glob.endsWith("/")) {
                yield glob;
            }
        }
    }
}

/**
 * Expand the given globs into files.
 *
 * @param {Array<string>} globs The globs to expand.
 */
export default async function getFiles(
    includeGlobs: Array<string>,
    excludeGlobs: Array<string>,
    log: ILog,
): Promise<Array<string>> {
    const includePatterns = Array.from(turnIgnoresToGlobs(includeGlobs));
    log.verbose(
        () => `Include globs: ${JSON.stringify(includePatterns, null, "    ")}`,
    );
    const excludePatterns = Array.from(turnIgnoresToGlobs(excludeGlobs));
    log.verbose(
        () => `Exclude globs: ${JSON.stringify(excludePatterns, null, "    ")}`,
    );

    // Now let's match the patterns and see what files we get.
    const paths = await glob(includePatterns, {
        onlyFiles: true,
        absolute: true,
        ignore: excludePatterns,
    });
    const sortedPaths = paths
        .map((p) => p.replace(new RegExp("/", "g"), path.sep))
        .sort();
    log.verbose(
        () => `Discovered paths: ${JSON.stringify(sortedPaths, null, "    ")}`,
    );
    return sortedPaths;
}
