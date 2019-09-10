// @flow
import path from "path";

export default function(filePath: string) {
    return path.relative(process.cwd(), filePath);
}
