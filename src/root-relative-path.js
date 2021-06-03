// @flow
import path from "path";
import ancesdir from "ancesdir";

export default function (filePath: string, marker?: ?string): string {
    if (!path.isAbsolute(filePath)) {
        return filePath;
    }
    const rootPath = ancesdir(filePath, marker);
    return path.relative(rootPath, filePath);
}
