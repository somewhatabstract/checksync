// @flow
import fs from "fs";
import path from "path";
import parseGitIgnore from "parse-gitignore";
import ignoreFormatToGlobs from "./ignore-format-to-globs.js";
import defaultArgs from "./default-args.js";

import {promisify} from "util";

const readFileAsync = promisify(fs.readFile);

export default async (filePath: string): Promise<$ReadOnlyArray<string>> => {
    // If we are only processing the default ignore file and it doesn't exist,
    // we can just return an empty array.
    if (filePath === defaultArgs.ignoreFiles && !fs.existsSync(filePath)) {
        return [];
    }

    // NOTE: If it's not the default path then we're going to error if it
    // doesn't exist. We may want to consider skipping over ignore files that
    // don't exist, but this does tell folks that they specified a file that
    // doesn't exist, so if we handle this differently, we'll want to make sure
    // we validate CLI arguments differently to still give useful feedback.

    // Read the file
    const fileContent = await readFileAsync(filePath);

    // Parse it as .gitignore syntax, then turn those to globs.
    const ignoreRules = parseGitIgnore(fileContent);

    // Turn those rules into globs.
    const globs = ignoreFormatToGlobs(ignoreRules);

    // Get the directory for the ignore file.
    const rootDir = path.dirname(path.resolve(filePath));

    // Now, anchor them at the ignore file's path.
    return Array.from(globs).map((i) => path.join(rootDir, i));
};
