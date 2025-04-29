import fs from "fs";
import path from "path";
import glob from "fast-glob";
import defaultOptions from "./default-options";
import {ILog} from "./types";
import ignoreFilesToFunctions from "./ignore-files-to-functions";

/**
 * Given globs or paths to gitignore files, return a predicate for filtering.
 *
 * @param ignoreFileGlobs The globs or paths to gitignore files.
 * @returns A predicate for filtering. If the predicate returns true, the file
 * should be accepted; otherwise, it should be ignored.
 */
export default async (
    ignoreFileGlobs: ReadonlyArray<string>,
    log: ILog,
): Promise<(f: string) => boolean> => {
    // If we are only processing the default ignore file and it doesn't exist,
    // in the working directory we can return a predicate that always returns
    // true.
    if (
        ignoreFileGlobs.length === defaultOptions.ignoreFiles.length &&
        ignoreFileGlobs[0] === defaultOptions.ignoreFiles[0] &&
        !fs.existsSync(ignoreFileGlobs[0])
    ) {
        return Promise.resolve(() => true);
    }

    // NOTE: If it's not the default path then we're going to error if it
    // doesn't exist. We may want to consider skipping over ignore files that
    // don't exist, but this does tell folks that they specified a file that
    // doesn't exist, so if we handle this differently, we'll want to make sure
    // we validate CLI arguments differently to still give useful feedback.

    // The array is either file paths or globs. We need to expand the globs
    // to get the actual file paths.
    const ignoreFiles =
        ignoreFileGlobs.length === 0
            ? []
            : (
                  await glob([...ignoreFileGlobs], {
                      onlyFiles: true,
                      absolute: true,
                      followSymbolicLinks: false,
                  })
              )
                  // We need to make sure that we apply our ignore files in
                  // order, from the top directory down. This allows an ignore
                  // file close to a file being processed to override an ignore
                  // file higher up in the directory tree.
                  .sort();

    log.verbose(() => `Ignore files: ${JSON.stringify(ignoreFiles, null, 4)}`);

    // Now, we load the ignore files and create a function for each of them
    // that will tell us what it wants to do with any specific file; ignore,
    // unignore, or no-op.
    const ignoreStateFunctions = await ignoreFilesToFunctions(ignoreFiles, log);

    // Finally, we return a predicate that checks a given file path against
    // each of the predicates we've loaded.
    return (filePath: string) => {
        if (!path.isAbsolute(filePath)) {
            throw new Error("Expected absolute file path.");
        }
        return (
            ignoreStateFunctions.reduce(
                (acc, ignoreStateFn) => {
                    const result = ignoreStateFn(filePath);

                    // If the ignore file has an opinion, we change to that
                    // opinion. Otherwise, we keep the previous opinion.
                    return result == null ? acc : result;
                },
                // We start without an opinion - if we don't reach an opinion
                // by the end, then we allow the file.
                undefined as boolean | undefined,
            ) ?? true
        );
    };
};
