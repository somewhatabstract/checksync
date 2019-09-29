// @flow
import fs from "fs";
import path from "path";

import type {NormalizedFileInfo} from "./types.js";

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
    const exists =
        fs.existsSync(normalizedFileRef) &&
        fs.lstatSync(normalizedFileRef).isFile();
    return {file: normalizedFileRef, exists};
};

export default getNormalizedTargetFileInfo;
