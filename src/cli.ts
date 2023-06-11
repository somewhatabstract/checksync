/**
 * The implementation of our command line utility.
 */
import fs from "fs";
import chalk from "chalk";
import minimist from "minimist";
import checkSync from "./check-sync";
import Logger from "./logger";
import {ExitCode} from "./exit-codes";
import logHelp from "./help";
import {version} from "../package.json";
import determineOptions from "./determine-options";
import exit from "./exit";

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
        string: [
            "cwd",
            "comments",
            "rootMarker",
            "ignore",
            "ignoreFiles",
            "config",
        ],
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
            if (arg === process.execPath) {
                return false;
            }
            // Filter out our entry point.
            if (arg === launchFilePath) {
                return false;
            }
            // Filter out the command that yarn/npm might install.
            if (arg.endsWith(".bin/checksync")) {
                return false;
            }
            // Handle the entry point being a symlink
            try {
                const realpath = fs.realpathSync(arg);
                if (realpath === launchFilePath) {
                    return false;
                }
            } catch {
                /* ignore errors, the arg may not be a path at all */
            }

            if (arg.startsWith("-")) {
                log.error(`Unknown argument: ${arg}`);
                exit(log, ExitCode.UNKNOWN_ARGS);
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
        exit(log, ExitCode.SUCCESS);
    }

    if (args.help) {
        logHelp(log);
        exit(log, ExitCode.SUCCESS);
    }

    log.verbose(() => `Launched with args: ${JSON.stringify(args, null, 4)}`);

    // We need to apply the cwd argument to the process, otherwise the
    // configuration file discovery and other tasks will be working off a
    // different working directory.
    if (args.cwd != null) {
        log.verbose(() => `Changing working directory to ${args.cwd}`);
        try {
            process.chdir(args.cwd);
        } catch (e) {
            log.error(`Unable to set working directory: ${e}`);
            exit(log, ExitCode.CATASTROPHIC);
        }
    }

    // Parse arguments and configurations to get our options.
    return determineOptions(args, log)
        .then(
            (options) => checkSync(options, log),
            (e) => ExitCode.BAD_CONFIG,
        )
        .then(
            (exitCode) => {
                log.verbose(() => `Exiting with code ${exitCode}`);
                exit(log, exitCode);
            },
            (e) => {
                log.error(`Unexpected error: ${e}`);
                log.verbose(() => `Exiting with code ${ExitCode.CATASTROPHIC}`);
                exit(log, ExitCode.CATASTROPHIC);
            },
        );
};
