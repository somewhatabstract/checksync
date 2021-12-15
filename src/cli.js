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
import {version} from "../package.json";
import determineOptions from "./determine-options.js";

/**
 * Run the command line.
 *
 * @param {string} launchFilePath
 */
export const run = (launchFilePath: string): Promise<void> => {
    // Configure our logging output and argument parsing.
    chalk.level = 3;

    const log = new Logger(console);

    // NOTE: minimist treats `no` on the front of a known flag
    // as a flag inversion of the none-`no` version.
    const args = minimist(process.argv, {
        boolean: ["updateTags", "dryRun", "help", "verbose", "version", "json"],
        string: ["comments", "rootMarker", "ignore", "ignoreFiles", "config"],
        alias: {
            comments: ["c"],
            dryRun: ["n", "dry-run"],
            help: ["h", "?"],
            ignore: ["i"],
            ignoreFiles: ["ignore-files"],
            json: ["j"],
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
    if (args.verbose) {
        log.setVerbose();
    }

    // Process arguments that fail early.
    if (args.version) {
        log.log(version);
        process.exit(ExitCodes.SUCCESS);
    }

    if (args.help) {
        logHelp(log);
        process.exit(ExitCodes.SUCCESS);
    }

    log.verbose(() => `Launched with args: ${JSON.stringify(args, null, 4)}`);

    // Parse arguments and configurations to get our options.
    return determineOptions(args, log)
        .then(
            (options) => checkSync(options, log),
            (e) => ExitCodes.BAD_CONFIG,
        )
        .then(
            (exitCode) => {
                log.verbose(() => `Exiting with code ${exitCode}`);
                process.exit(exitCode);
            },
            (e) => {
                log.error(`Unexpected error: ${e}`);
                log.verbose(
                    () => `Exiting with code ${ExitCodes.CATASTROPHIC}`,
                );
                process.exit(ExitCodes.CATASTROPHIC);
            },
        );
};
