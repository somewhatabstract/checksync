// @flow
import glob from "fast-glob";
import path from "path";

/**
 * Following gitignore format https://git-scm.com/docs/gitignore#_pattern_format
 *
 * /foo  Ignore root (not sub) file and dir and its paths underneath.     /foo, /foo/**
 * /foo/ Ignore root (not sub) foo dir and its paths underneath.          /foo/**
 * foo   Ignore (root/sub) foo files and dirs and their paths underneath. foo, ** /foo/**
 * foo/  Ignore (root/sub) foo dirs and their paths underneath.	          ** /foo/**
 */
function* turnIgnoresToGlobs(globs: Array<string>): Iterator<string> {
    for (const glob of globs) {
        if (glob.startsWith("/")) {
            yield path.join(glob, "**").replace("\\", "/");
            if (!glob.endsWith("/")) {
                yield glob;
            }
        } else {
            yield path.join("**", glob, "**").replace("\\", "/");
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
): Promise<Array<string>> {
    const includePatterns = Array.from(turnIgnoresToGlobs(includeGlobs));
    const excludePatterns = Array.from(turnIgnoresToGlobs(excludeGlobs));

    // Now let's match the patterns and see what files we get.
    const paths = await glob(includePatterns, {
        onlyFiles: true,
        absolute: true,
        ignore: excludePatterns,
    });
    return paths.sort();
}
