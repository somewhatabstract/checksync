// @flow
/**
 * The implementation of our command line utility.
 */
import chalk from "chalk";
import minimist from "minimist";
import checkSync from "./check-sync.js";
import Logger from "./logger.js";
import ErrorCodes from "./error-codes.js";
import logHelp from "./help.js";

export const defaultArgs = {
    "update-tags": false,
    comments: `${["#,//"].sort().join(",")}`,
    ignore: "",
    help: false,
    "dry-run": false,
};

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
        boolean: ["update-tags", "dry-run", "help"],
        string: ["comments", "root-marker", "ignore"],
        default: {
            ...defaultArgs,
        },
        alias: {
            comments: ["c"],
            "dry-run": ["n"],
            help: ["h"],
            ignore: ["i"],
            "root-marker": ["m"],
            "update-tags": ["u"],
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
    const excludeGlobs = ((args.ignore: any): string)
        .split(",")
        .filter(c => !!c);

    // Make sure we have something to search, so default to current working
    // directory if no globs are given.
    const includeGlobs = args._ && args._.length > 0 ? args._ : [process.cwd()];

    checkSync(
        {
            includeGlobs,
            excludeGlobs,
            autoFix: args["update-tags"] === true,
            comments,
            rootMarker: (args["root-marker"]: any),
            dryRun: args["dry-run"] === true,
        },
        log,
    ).then(exitCode => process.exit(exitCode));
};
