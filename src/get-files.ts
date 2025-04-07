import glob from "fast-glob";
import path from "path";
import fs from "fs";
import ignoreFileGlobsToAllowPredicate from "./ignore-file-globs-to-allow-predicate";

import {ILog, Options} from "./types";

/**
 * Expand the given globs and ignore files into a list of files.
 *
 * @param {Array<string>} includeGlobs The include globs to expand.
 * @param {Array<string>} excludeGlobs The exclude globs to expand.
 * @param {Array<string>} ignoreFiles The ignore files to expand.
 * @param {ILog} log A log to record things
 */
export default async function getFiles(
    {includeGlobs, excludeGlobs, ignoreFiles, includeDotPaths}: Options,
    log: ILog,
): Promise<Array<string>> {
    // We turn all the ignore files we're using into a single predicate that
    // returns true if a file is allowed, or false if it is ignored.
    const allowPredicate = await ignoreFileGlobsToAllowPredicate(
        ignoreFiles,
        log,
    );

    // If any of our input globs don't contain a * and they are a directory
    // then let's make that be a glob of everything under that dir.
    // If we don't do this then checksync feels counterintuitive as
    // just a directory like __examples__ won't work, and __examples__/**
    // may get expanded by the shell, so folks would have to do
    // __examples__/**/* which is just annoying.
    // With this change, any input directories are expanded to mean all
    // files below that directory and that directory's children.
    includeGlobs = includeGlobs.map((pattern: string) =>
        !pattern.includes("*") &&
        // TODO: Use throwIfNoEntry in lstatSync/lstat to replace need to do
        // the existence check, once we are on versions of Node that support it.
        fs.existsSync(pattern) &&
        fs.lstatSync(pattern).isDirectory()
            ? `${pattern}/**`
            : pattern,
    );

    log.verbose(
        () => `Include globs: ${JSON.stringify(includeGlobs, null, 4)}`,
    );
    log.verbose(
        () => `Exclude globs: ${JSON.stringify(excludeGlobs, null, 4)}`,
    );

    // Now let's match the patterns and see what files we get.
    const paths = await glob([...includeGlobs], {
        onlyFiles: true,
        absolute: true,
        dot: includeDotPaths,
        ignore: excludeGlobs as Array<string>, // remove readonly-ness
    });
    const sortedPaths = paths
        // Sort the paths first to ensure we get a deterministic output.
        .sort()
        // Filter out any paths that are not allowed by the ignore files.
        .filter((p) => allowPredicate(p))
        // Replace the `/` with the OS-specific path separator.
        .map((p) => p.replace(new RegExp("/", "g"), path.sep));
    log.verbose(
        () => `Discovered paths: ${JSON.stringify(sortedPaths, null, 4)}`,
    );
    return sortedPaths;
}
