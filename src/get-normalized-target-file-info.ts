import fs from "fs";
import path from "path";

import {NormalizedFileInfo} from "./types";

/**
 * Get normalized path and existence for given target.
 *
 * @param {string} rootPath The absolute path of the root directory for the
 * check run.
 * @param {string} fileRef The path, relative to `rootPath` of the file to be
 * normalized.
 * @returns {NormalizedFileInfo} The info for the given `fileRef` file.
 */
const getNormalizedTargetFileInfo = (
    rootPath: string,
    fileRef: string,
): NormalizedFileInfo => {
    // Target paths are relative to the root location.
    const normalizedFileRef = path.normalize(path.join(rootPath, fileRef));

    // Also, we want to ensure we're always using OS-specific pathing
    // internally.
    const osPathSep = normalizedFileRef.replace(new RegExp("/", "g"), path.sep);
    const exists = fs.existsSync(osPathSep) && fs.lstatSync(osPathSep).isFile();
    return {file: osPathSep, exists};
};

export default getNormalizedTargetFileInfo;
