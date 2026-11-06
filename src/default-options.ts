import {Options} from "./types";
const defaultOptions: Options = {
    autoFix: false,
    json: false,
    allowEmptyTags: false,
    comments: ["#", "//", "{/*"],
    excludeGlobs: [],
    dryRun: false,
    ignoreFiles: [".gitignore"],
    // Make sure we have something to search, so default to everything below
    // the current working directory if no globs are given. A folder expands
    // to everything below it when files are found, so this follows `--cwd`.
    includeGlobs: ["."],
    cachePath: "cache.json",
    cacheMode: "ignore",
};

export default defaultOptions;
