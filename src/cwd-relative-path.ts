import path from "path";

export default function (filePath: string): string {
    return path.relative(process.cwd(), filePath);
}
