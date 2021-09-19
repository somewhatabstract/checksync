// @flow
import path from "path";
import {ancesdirOrCurrentDir} from "./ancesdir-or-currentdir.js";

export default function (filePath: string, marker?: ?string): string {
    if (!path.isAbsolute(filePath)) {
        return filePath;
    }
    const rootPath = ancesdirOrCurrentDir(filePath, marker);
    return path.relative(rootPath, filePath);
}
