// @flow
/**
 * The implementation of our command line utility.
 */
import fs from "fs";
import chalk from "chalk";
import minimist from "minimist";
import checkSync from "./check-sync.js";
import Logger from "./logger.js";
import ExitCodes from "./exit-codes.js";
import logHelp from "./help.js";
import defaultArgs from "./default-args.js";
import {version} from "../package.json";

/**
 * Run the command line.
 *
 * @param {string} launchFilePath
 */
export const run = (launchFilePath: string): void => {
    chalk.level = 3;

    const log = new Logger(console);

    // TODO(somewhatabstract): Verbose logging (make sure any caught errors
    // verbose their error messages)
    const args = minimist(process.argv, {
        boolean: [
            "updateTags",
            "dryRun",
            "help",
            "noIgnoreFile",
            "verbose",
            "version",
            "json",
        ],
        string: ["comments", "rootMarker", "ignore", "ignoreFiles"],
        default: {
            ...defaultArgs,
        },
        alias: {
            comments: ["c"],
            dryRun: ["n", "dry-run"],
            help: ["h", "?"],
            ignore: ["i"],
            ignoreFiles: ["ignore-files"],
            json: ["j"],
            noIgnoreFile: ["no-ignore-file"],
            rootMarker: ["m", "root-marker"],
            updateTags: ["u", "update-tags"],
        },
        unknown: (arg) => {
            // Filter out the node process.
            if (arg === process.execPath) return false;
            // Filter out our entry point.
            if (arg === launchFilePath) return false;
            // Filter out the command that yarn/npm might install.
            if (arg.endsWith(".bin/checksync")) return false;
            // Handle the entry point being a symlink
            try {
                const realpath = fs.realpathSync(arg);
                if (realpath == launchFilePath) return false;
            } catch {
                /* ignore errors, the arg may not be a path at all */
            }

            if (arg.startsWith("-")) {
                log.error(`Unknown argument: ${arg}`);
                process.exit(ExitCodes.UNKNOWN_ARGS);
            }
            return true;
        },
    });

    if (args.version) {
        log.log(version);
        process.exit(ExitCodes.SUCCESS);
    }

    if (args.help) {
        logHelp(log);
        process.exit(ExitCodes.SUCCESS);
    }

    if (args.verbose) {
        log.setVerbose();
    }
    log.verbose(
        () => `Launched with args: ${JSON.stringify(args, null, "    ")}`,
    );

    const comments = ((args.comments: any): string)
        .split(" ")
        .filter((c) => !!c);
    const ignoreGlobs = ((args.ignore: any): string)
        .split(";")
        .filter((c) => !!c);

    const ignoreFiles = args.noIgnoreFile
        ? []
        : ((args.ignoreFiles: any): string).split(",").filter((c) => !!c);

    // Make sure we have something to search, so default to current working
    // directory if no globs are given.
    const includeGlobs =
        args._ && args._.length > 0 ? args._ : [`${process.cwd()}/**`];

    checkSync(
        {
            includeGlobs,
            excludeGlobs: ignoreGlobs,
            ignoreFiles,
            autoFix: args.updateTags === true,
            json: args.json === true,
            comments,
            rootMarker: (args.rootMarker: any),
            dryRun: args.dryRun === true,
        },
        log,
    ).then(
        (exitCode) => {
            log.verbose(() => `Exiting with code ${exitCode}`);
            process.exit(exitCode);
        },
        (e) => {
            log.error(`Unexpected error: ${e}`);
            log.verbose(() => `Exiting with code ${ExitCodes.CATASTROPHIC}`);
            process.exit(ExitCodes.CATASTROPHIC);
        },
    );
};
