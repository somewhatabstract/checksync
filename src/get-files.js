// @flow
import fs from "fs";
import glob from "fast-glob";
import path from "path";

function turnDirectoriesToGlobs(globs: Array<string>): Array<string> {
    return (
        globs
            // If we have a dir, let's make that a be everything under that dir.
            .map((pattern: string) =>
                fs.existsSync(pattern) && fs.lstatSync(pattern).isDirectory()
                    ? path.join(pattern, "**")
                    : pattern,
            )
    );
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
    const includePatterns = turnDirectoriesToGlobs(includeGlobs);
    const excludePatterns = turnDirectoriesToGlobs(excludeGlobs);

    // Now let's match the patterns and see what files we get.
    const paths = await glob(includePatterns, {
        onlyFiles: true,
        absolute: true,
        ignore: excludePatterns,
    });
    return paths.sort();
}
