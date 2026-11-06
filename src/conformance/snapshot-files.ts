import fs from "fs";
import path from "path";

import {FileEntry, FileSnapshot} from "./types";

/**
 * Record every file and symbolic link within a directory tree.
 *
 * Links are recorded with their targets rather than followed, and
 * directories are walked but not recorded themselves.
 *
 * @param dir The absolute path of the directory to snapshot.
 * @returns The entries, keyed by forward-slash path relative to `dir`.
 */
export default function snapshotFiles(dir: string): FileSnapshot {
    const snapshot = new Map<string, FileEntry>();
    const walk = (relativeDir: string): void => {
        for (const name of fs.readdirSync(path.join(dir, relativeDir))) {
            const relativePath =
                relativeDir === "" ? name : `${relativeDir}/${name}`;
            const fullPath = path.join(dir, relativePath);
            const stats = fs.lstatSync(fullPath);
            if (stats.isSymbolicLink()) {
                snapshot.set(relativePath, {
                    kind: "symlink",
                    target: fs.readlinkSync(fullPath),
                });
            } else if (stats.isDirectory()) {
                walk(relativePath);
            } else {
                snapshot.set(relativePath, {
                    kind: "file",
                    content: fs.readFileSync(fullPath),
                });
            }
        }
    };
    walk("");
    return snapshot;
}
