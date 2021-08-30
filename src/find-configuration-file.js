// @flow
import fs from "fs";
import path from "path";
import ancesdir from "ancesdir";

import type {ILog} from "./types.js";

export const checkSyncRcNames = [".checksyncrc", ".checksyncrc.json"];

export default function findConfigurationFile(
    configFile: ?string,
    rootMarker: ?string,
    log: ILog,
): ?string {
    // If we have a configFile, we can try that.
    if (configFile != null) {
        log.verbose(() => `Using --config file: ${configFile}`);
        return configFile;
    }

    log.verbose(() => `Looking for configuration file...`);

    // Let's look for the root marker relative to our current working directory
    // and see if there's one adjacent to it.
    try {
        const rootPath = ancesdir(process.cwd(), rootMarker);
        for (const rcPath of checkSyncRcNames.map((rc) =>
            path.join(rootPath, rc),
        )) {
            if (fs.existsSync(rcPath)) {
                log.verbose(() => `Found configuration file: ${rcPath}`);
                return rcPath;
            }
        }
    } catch (e) {
        // Root marker not found based on the current working directory.
        // We'll just ignore this.
    }

    // Let's look for an rc file relative to our current working directory.
    // For this, we find the one that's closest.
    const closestRCPath = checkSyncRcNames
        .map((rc) => {
            try {
                return ancesdir(process.cwd(), rc);
            } catch (e) {
                return "";
            }
        })
        .filter((f) => f != "")
        .map((rcPath) => ({
            rcPath,
            distance: path.relative(process.cwd(), rcPath).split(path.sep)
                .length,
        }))
        .reduce((acc, cur) => {
            if (acc == null || cur.distance < acc.distance) {
                return cur;
            }
            return acc;
        }, null);
    if (closestRCPath != null) {
        log.verbose(() => `Found configuration file: ${closestRCPath.rcPath}`);
        return closestRCPath.rcPath;
    }
    log.verbose(() => "No configuration file found.");
    return null;
}
