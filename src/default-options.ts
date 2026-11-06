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
    // the current working directory if no globs are given. When a
    // configuration file moves the working directory, determineOptions points
    // this back at the folder checksync started in.
    includeGlobs: ["**"],
    cachePath: "cache.json",
    cacheMode: "ignore",
};

export default defaultOptions;
