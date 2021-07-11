// @flow
import fs from "fs";
import parseGitIgnore from "parse-gitignore";
import ignoreFormatToGlobs from "./ignore-format-to-globs.js";
import defaultArgs from "./default-args.js";

export default (
    ignoreFiles: $ReadOnlyArray<string>,
): $ReadOnlyArray<string> => {
    // If we are only processing the default ignore file and it doesn't exist,
    // we can just return an empty array.
    if (
        ignoreFiles.length === 1 &&
        ignoreFiles[0] === defaultArgs.ignoreFiles &&
        !fs.existsSync(ignoreFiles[0])
    ) {
        return [];
    }

    // TODO: We need to glob some of these and then we need to expand their
    // ignores based on their file location.

    // TODO: Use Promise.all and async reads to see if some of this can be
    // parallelized.
    const allIgnores = ignoreFiles
        // Read the file - this currently assumes it exists, we may want
        // to consider skipping over ignore files that don't exist.
        .map((file) => fs.readFileSync(file))
        // Parse it as .gitignore syntax.
        .map((content: Buffer) => parseGitIgnore(content))
        // Flatten our array of arrays into a single array.
        .reduce((prev, current: Array<string>) => [...prev, ...current], []);

    const allIgnoresWithoutDuplicates = Array.from(new Set(allIgnores));

    // Transform ignore syntax to globs.
    return Array.from(ignoreFormatToGlobs(allIgnoresWithoutDuplicates));
};
