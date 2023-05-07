import path from "path";
import cwdRelativePath from "./cwd-relative-path";

export default function getLaunchString(): string {
    const checkSyncBinMain = cwdRelativePath(process.argv[1]);

    // If we're in the node_modules .bin directory, let's assume NPM/Yarn.
    if (checkSyncBinMain.endsWith(path.join(".bin", "checksync"))) {
        if (
            process.env.npm_execpath &&
            process.env.npm_execpath.indexOf("yarn") >= 0
        ) {
            return "yarn checksync";
        }

        return "npx checksync";
    }

    // We're not running from an install.
    return checkSyncBinMain;
}
