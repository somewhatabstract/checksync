import ignoreFileToFunction from "./ignore-file-to-function";

import {ILog} from "./types";

/**
 * Create a function for each ignore file that codifies the ignore file.
 *
 * @param ignoreFilePaths The paths to the ignore files.
 * @returns The functions that codify the ignore files. Each function takes a
 * file path and returns true if the file should be allowed, false if it should
 * be ignored, or undefined if the ignore file has no opinion about the file.
 */
export default async (
    ignoreFilePaths: ReadonlyArray<string>,
    log: ILog,
): Promise<ReadonlyArray<(f: string) => boolean | undefined>> => {
    // Now, we load the ignore files and create a predicate for each of them,
    // mapped from their parent directory path.
    const seenGitIgnorePaths = new Set<string>();
    const functionPromises = ignoreFilePaths.map((gitIgnorePath) => {
        // If we've already loaded the ignore file, we can skip it.
        if (seenGitIgnorePaths.has(gitIgnorePath)) {
            return Promise.resolve(undefined);
        }
        // We add the path to the set of paths we've seen so we don't
        // load it again.
        seenGitIgnorePaths.add(gitIgnorePath);
        return ignoreFileToFunction(gitIgnorePath, log);
    });
    const maybeFunctions = await Promise.all(functionPromises);
    return maybeFunctions.filter(
        (x): x is (f: string) => boolean | undefined => x != null,
    );
};
