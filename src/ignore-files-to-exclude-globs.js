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

    return (
        ignoreFiles
            // Read the file - this currently assumes it exists, we may want
            // to consider skipping over ignore files that don't exist.
            .map((file) => fs.readFileSync(file))
            // Parse it as .gitignore syntax.
            .map((content: Buffer) => parseGitIgnore(content))
            // Transform ignore syntax to globs.
            .map((ignores) => Array.from(ignoreFormatToGlobs(ignores)))
            // Flatten our array of arrays into a single array.
            .reduce((prev, current: Array<string>) => [...prev, ...current], [])
    );
};
