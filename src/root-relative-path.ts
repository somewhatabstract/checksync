import path from "path";
import {ancesdirOrCurrentDir} from "./ancesdir-or-currentdir";

export default function (filePath: string, marker?: string | null): string {
    if (!path.isAbsolute(filePath)) {
        return filePath;
    }
    const rootPath = ancesdirOrCurrentDir(filePath, marker);
    return path.relative(rootPath, filePath);
}
