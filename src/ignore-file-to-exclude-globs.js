// @flow
import fs from "fs";
import path from "path";
import parseGitIgnore from "parse-gitignore";
import ignoreFormatToGlobs from "./ignore-format-to-globs.js";
import normalizeSeparators from "./normalize-separators.js";

import {promisify} from "util";

const readFileAsync = promisify(fs.readFile);

export default async (filePath: string): Promise<$ReadOnlyArray<string>> => {
    // Read the file
    const fileContent = await readFileAsync(filePath);

    // Parse it as .gitignore syntax, then turn those to globs.
    const ignoreRules = parseGitIgnore(fileContent);

    // Turn those rules into globs.
    const globs = ignoreFormatToGlobs(ignoreRules);

    // Get the directory for the ignore file.
    const rootDir = path.dirname(path.resolve(filePath));

    // Now, anchor them at the ignore file's path.
    return Array.from(globs).map((i) =>
        normalizeSeparators(path.join(rootDir, i)),
    );
};
