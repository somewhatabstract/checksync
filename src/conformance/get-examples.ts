import fs from "fs";
import path from "path";

/**
 * Get the names of the example directories, sorted for a stable order.
 *
 * @param examplesDir The absolute path of the `__examples__` directory.
 * @returns The names of the directories within it.
 */
export default function getExamples(examplesDir: string): Array<string> {
    return fs
        .readdirSync(examplesDir)
        .filter((name) =>
            fs.lstatSync(path.join(examplesDir, name)).isDirectory(),
        )
        .sort();
}
