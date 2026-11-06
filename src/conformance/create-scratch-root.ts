import fs from "fs";
import os from "os";
import path from "path";

/**
 * Files at the repository root that affect how checksync treats an example.
 *
 * `package.json` is the root marker that self-checksums are relative to, and
 * the configuration and ignore files change which files are scanned.
 */
const ROOT_FILES = ["package.json", ".checksyncrc.json", ".gitignore"];

/**
 * Copy an example into a new scratch root so that it can be changed safely.
 *
 * The scratch root mirrors the repository root as far as checksync can tell,
 * so the example lives at the same root-relative path and gives the same
 * checksums and output. Symbolic links are copied as links.
 *
 * @param rootDir The absolute path of the repository root.
 * @param example The name of the directory within `__examples__` to copy.
 * @returns The absolute, real path of the scratch root, which the caller
 * removes when done.
 */
export default function createScratchRoot(
    rootDir: string,
    example: string,
): string {
    // The real path is what checksync sees as its working directory, so it
    // is the path that has to be normalized out of its output.
    const scratchRoot = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "checksync-conformance-")),
    );
    for (const file of ROOT_FILES) {
        fs.copyFileSync(path.join(rootDir, file), path.join(scratchRoot, file));
    }
    fs.cpSync(
        path.join(rootDir, "__examples__", example),
        path.join(scratchRoot, "__examples__", example),
        {recursive: true, verbatimSymlinks: true},
    );
    return scratchRoot;
}
