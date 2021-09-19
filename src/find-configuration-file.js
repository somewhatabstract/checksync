// @flow
import fs from "fs";
import path from "path";

import {ancesdirOrCurrentDir} from "./ancesdir-or-currentdir.js";

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

    log.verbose(() => `Looking for configuration file based on root marker...`);

    // Let's look for the root marker relative to our current working directory
    // and see if there's one adjacent to it.
    try {
        const rootPath = ancesdirOrCurrentDir(process.cwd(), rootMarker);
        for (const rcPath of checkSyncRcNames.map((rc) =>
            path.join(rootPath, rc),
        )) {
            log.verbose(() => `Checking ${rcPath}...`);
            if (fs.existsSync(rcPath)) {
                log.verbose(() => `Found configuration file: ${rcPath}`);
                return rcPath;
            }
        }
    } catch (e) {
        // Root marker not found based on the current working directory.
        // We'll just ignore this.
        log.verbose(() => `Root marker based configuration not found`);
    }

    log.verbose(
        () =>
            `Looking for configuration based on current working directory: ${process.cwd()}`,
    );

    // Let's look for an rc file relative to our current working directory.
    // For this, we find the one that's closest.
    const closestRCPath = checkSyncRcNames
        .map((rc) => {
            try {
                // Could be in the working directory too, so we add a fake child
                // to the path that ancesdir will cut off to start the search
                // in parent locations, which will then be the cwd.
                return path.join(ancesdirOrCurrentDir(process.cwd(), rc), rc);
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
