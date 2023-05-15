import asyncfs from "fs/promises";
import path from "path";
import ignore from "ignore";

import {ILog} from "./types";
import Format from "./format";

/**
 * Create a function that codifies a given ignore file.
 *
 * @param gitIgnorePath The path to the ignore file.
 * @returns A function that takes a file path and returns true if the file
 * should be allowed, false if it should be ignored, or undefined if the
 * ignore file has no opinion about the file.
 */
export default async (
    gitIgnorePath: string,
    log: ILog,
): Promise<(f: string) => boolean | undefined> => {
    const ignoreFileContents = await asyncfs.readFile(gitIgnorePath, "utf8");
    const gitIgnoreDir = path.dirname(gitIgnorePath);
    const ignorer = ignore().add(ignoreFileContents);

    // We return a predicate that checks if the given file path is
    // in a directory governed by the ignore file and if so, whether
    // it should be allowed per that ignore file's rules.
    return (filePath: string) => {
        if (!filePath.startsWith(gitIgnoreDir)) {
            // This file path is not in a directory governed by the
            // ignore file, so this ignore file has no opinion
            return undefined;
        }

        // Find out if the ignore file has an opinion about this file path.
        const relativePath = path.relative(gitIgnoreDir, filePath);
        const {ignored, unignored} = ignorer.test(relativePath);

        log.verbose(() => {
            if (ignored) {
                return `IGNORED  : ${Format.cwdFilePath(
                    filePath,
                )} by ${Format.cwdFilePath(gitIgnorePath)}`;
            }
            if (unignored) {
                return `UNIGNORED: ${Format.cwdFilePath(
                    filePath,
                )} by ${Format.cwdFilePath(gitIgnorePath)}`;
            }
        });

        // Return false if explicitly ignored, true if explicitly unignored,
        // or undefined if the ignore file has no opinion.
        return ignored ? false : unignored ? true : undefined;
    };
};
