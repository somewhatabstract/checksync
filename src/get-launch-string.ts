import path from "path";
import cwdRelativePath from "./cwd-relative-path";

export default function getLaunchString(): string {
    const checkSyncBinMain = cwdRelativePath(process.argv[1]);

    // If we're in the node_modules .bin directory, and we have the npm_execpath
    // environment variable, we are using a package manager to run checksync.
    if (checkSyncBinMain.endsWith(path.join(".bin", "checksync"))) {
        if (process.env.npm_execpath) {
            if (process.env.npm_execpath.indexOf("yarn") >= 0) {
                return "yarn checksync";
            }
            if (process.env.npm_execpath.indexOf("pnpm") >= 0) {
                return "pnpm checksync";
            }
        }

        return "npx checksync";
    }

    // We're not running from an install.
    return checkSyncBinMain;
}
