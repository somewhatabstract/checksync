// @flow
import type {Options} from "./types.js";
const defaultOptions: Options = {
    autoFix: false,
    json: false,
    comments: ["#", "//", "{/*"],
    excludeGlobs: [],
    dryRun: false,
    ignoreFiles: [".gitignore"],
    // Make sure we have something to search, so default to current working
    // directory if no globs are given.
    includeGlobs: [`${process.cwd()}/**`],
};

export default defaultOptions;
