// @flow
/**
 * The implementation of our command line utility.
 */
import minimist from "minimist";
import { checkSync } from "./index.js";

/**
 * Run the command line.
 *
 * @param {string} launchFilePath
 */
export const run = (launchFilePath: string): void => {
    const args = minimist(process.argv, {
        boolean: ["fix"],
        default: {
            fix: false,
        },
        alias: {
            fix: ["f"],
        },
        unknown: arg => {
            // Filter out the node process.
            if (arg === process.execPath) return false;
            // Filter out our entry point.
            if (arg === (launchFilePath || __filename)) return false;
            // Filter out the command that yarn/npm might install.
            if (arg.endsWith(".bin/checksync")) return false;
            return true;
        },
    });

    checkSync(args._, args.fix === true);
};
