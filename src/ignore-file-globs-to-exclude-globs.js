// @flow
import fs from "fs";
import glob from "fast-glob";
import ignoreFileToExcludeGlobs from "./ignore-file-to-exclude-globs.js";
import defaultArgs from "./default-args.js";

export default async (
    ignoreFileGlobs: $ReadOnlyArray<string>,
): Promise<$ReadOnlyArray<string>> => {
    // If we are only processing the default ignore file and it doesn't exist,
    // we can just return an empty array.
    if (
        ignoreFileGlobs.length === 1 &&
        ignoreFileGlobs[0] === defaultArgs.ignoreFiles &&
        !fs.existsSync(ignoreFileGlobs[0])
    ) {
        return [];
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
            : await glob(ignoreFileGlobs, {
                  onlyFiles: true,
                  absolute: true,
              });

    // Load the files as the globs they describe.
    const ignoresByFile = await Promise.all(
        ignoreFiles.map((file) => ignoreFileToExcludeGlobs(file)),
    );

    // Flatten our array of arrays into a single array.
    const allIgnores = ignoresByFile.reduce(
        (prev, current) => [...prev, ...current],
        [],
    );

    // Remove duplicates (though there shouldn't be any).
    return Array.from(new Set(allIgnores));
};
