import path from "path";
import glob from "fast-glob";

/**
 * Get the include globs for checking every file below a folder.
 *
 * Include globs are resolved from the current working directory, which can
 * differ from the folder checksync started in once a configuration file has
 * been found.
 *
 * @param startDir The folder checksync started in, after any `--cwd`.
 * @returns A glob, relative to the current working directory, that matches
 * every file below `startDir`.
 */
export default function defaultIncludeGlobs(startDir: string): Array<string> {
    const relativePath = path.relative(process.cwd(), startDir);
    return relativePath === ""
        ? ["**"]
        : [`${glob.convertPathToPattern(relativePath)}/**`];
}
