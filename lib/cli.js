// @flow
/**
 * The implementation of our command line utility.
 */
import chalk from "chalk";
import minimist from "minimist";
import checkSync from "./check-sync.js";
import "./shims.js";

/**
 * Run the command line.
 *
 * @param {string} launchFilePath
 */
export const run = (launchFilePath: string): void => {
    chalk.level = 3;
    chalk.enabled = true;

    const args = minimist(process.argv, {
        boolean: ["fix"],
        string: ["comments"],
        default: {
            fix: false,
            comments: "//,#",
        },
        alias: {
            fix: ["f"],
        },
        unknown: arg => {
            // Filter out the node process.
            if (arg === process.execPath) return false;
            // Filter out our entry point.
            if (arg === launchFilePath) return false;
            // Filter out the command that yarn/npm might install.
            if (arg.endsWith(".bin/checksync")) return false;
            return true;
        },
    });

    // This is going to be a string. $FlowFixMe
    const comments = args.comments.split(",");

    checkSync(args._, args.fix === true, comments);
};
