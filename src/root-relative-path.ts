import fs from "fs";
import path from "path";
import closestRootDir from "./closest-root-dir";

/**
 * The marker ancesdir looks for when none is given.
 */
const DEFAULT_MARKER = "package.json";

export default function (filePath: string, marker?: string | null): string {
    if (!path.isAbsolute(filePath)) {
        return filePath;
    }
    // The path may be a directory that is itself the root, so check it before
    // looking from the folder that contains it.
    const rootPath = fs.existsSync(
        path.join(filePath, marker ?? DEFAULT_MARKER),
    )
        ? filePath
        : closestRootDir(path.dirname(filePath), marker);
    return path.relative(rootPath, filePath);
}
