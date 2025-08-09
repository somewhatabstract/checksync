import path from "path";
import {closesdir} from "ancesdir";

export default function (filePath: string, marker?: string | null): string {
    if (!path.isAbsolute(filePath)) {
        return filePath;
    }
    const rootPath = closesdir(filePath, marker ?? undefined);
    return path.relative(rootPath, filePath);
}
