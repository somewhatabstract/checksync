// @flow
/**
 * The implementation of our command line utility.
 */
import fs from "fs";
import chalk from "chalk";
import minimist from "minimist";
import checkSync from "./check-sync.js";
import Logger from "./logger.js";
import ErrorCodes from "./error-codes.js";
import logHelp from "./help.js";
import defaultArgs from "./default-args.js";
import parseGitIgnore from "parse-gitignore";

/**
 * Run the command line.
 *
 * @param {string} launchFilePath
 */
export const run = (launchFilePath: string): void => {
    chalk.level = 3;
    chalk.enabled = true;

    const log = new Logger(console);

    // TODO(somewhatabstract): Verbose logging (make sure any caught errors
    // verbose their error messages)
    const args = minimist(process.argv, {
        boolean: ["updateTags", "dryRun", "help"],
        string: ["comments", "rootMarker", "ignore", "ignoreFile"],
        default: {
            ...defaultArgs,
        },
        alias: {
            comments: ["c"],
            dryRun: ["n", "dry-run"],
            help: ["h"],
            ignore: ["i"],
            ignoreFile: ["ignore-file"],
            rootMarker: ["m", "root-marker"],
            updateTags: ["u", "update-tags"],
        },
        unknown: arg => {
            // Filter out the node process.
            if (arg === process.execPath) return false;
            // Filter out our entry point.
            if (arg === launchFilePath) return false;
            // Filter out the command that yarn/npm might install.
            if (arg.endsWith(".bin/checksync")) return false;

            if (arg.startsWith("-")) {
                log.error(`Unknown argument: ${arg}`);
                process.exit(ErrorCodes.UNKNOWN_ARGS);
            }
            return true;
        },
    });

    if (args.help) {
        logHelp(log);
        process.exit(ErrorCodes.SUCCESS);
    }

    const comments = ((args.comments: any): string).split(",").filter(c => !!c);
    const ignoreGlobs = ((args.ignore: any): string)
        .split(",")
        .filter(c => !!c);
    const ignoreFileGlobs =
        args.ignoreFile != null
            ? parseGitIgnore(fs.readFileSync((args.ignoreFile: any)))
            : [];
    const excludeGlobs = [...ignoreGlobs, ...ignoreFileGlobs];

    // Make sure we have something to search, so default to current working
    // directory if no globs are given.
    const includeGlobs = args._ && args._.length > 0 ? args._ : [process.cwd()];

    checkSync(
        {
            includeGlobs,
            excludeGlobs,
            autoFix: args.updateTags === true,
            comments,
            rootMarker: (args.rootMarker: any),
            dryRun: args.dryRun === true,
        },
        log,
    ).then(exitCode => process.exit(exitCode));
};
