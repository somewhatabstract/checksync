import path from "path";
import glob from "fast-glob";

/**
 * Get the include globs for checking every file below a folder.
 *
 * Include globs are resolved from the current working directory, which can
 * differ from the folder checksync started in once a configuration file has
 * been found. When the start folder isn't below the current working
 * directory, a glob for it would start with `..`, which the configuration's
 * exclude globs can't match, so everything below the current working
 * directory is used instead.
 *
 * @param startDir The folder checksync started in, after any `--cwd`.
 * @returns A glob, relative to the current working directory, that matches
 * every file below `startDir`, or every file below the current working
 * directory if `startDir` is not inside it.
 */
export default function defaultIncludeGlobs(startDir: string): Array<string> {
    const relativePath = path.relative(process.cwd(), startDir);
    const isOutside =
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath);
    return relativePath === "" || isOutside
        ? ["**"]
        : [`${glob.convertPathToPattern(relativePath)}/**`];
}
