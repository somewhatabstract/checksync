import fs from "fs";
import path from "path";

import {NormalizedPathInfo} from "./types";

/**
 * Get normalized path and existence for given target.
 *
 * @param rootPath The absolute path of the root directory for the
 * check run.
 * @param ref The path, relative to `rootPath` of the file to be
 * normalized.
 * @returns The info for the given `targetRef` file.
 */
const getNormalizedPathInfo = (
    rootPath: string,
    ref: string,
): NormalizedPathInfo => {
    // If the targetRef is a URL, we just return that as-is and mark exists as
    // true by default. If we implement #2037, we can have exists be based on
    // some sort of fetch to detect if the URL is valid, perhaps.
    if (ref.includes("://")) {
        return {path: ref, exists: true, type: "remote"};
    }

    // Target paths are relative to the root location.
    const normalizedFileRef = path.normalize(path.join(rootPath, ref));

    // Also, we want to ensure we're always using OS-specific pathing
    // internally.
    const osPathSep = normalizedFileRef.replace(new RegExp("/", "g"), path.sep);
    const exists = fs.existsSync(osPathSep) && fs.lstatSync(osPathSep).isFile();
    return {path: osPathSep, exists, type: "local"};
};

export default getNormalizedPathInfo;
