// @flow
import path from "path";
import ancesdir from "ancesdir";

export default function(filePath: string, marker?: ?string) {
    const rootPath = ancesdir(filePath, marker);
    return path.relative(rootPath, filePath);
}
