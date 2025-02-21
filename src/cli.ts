/**
 * The implementation of our command line utility.
 */
import fs from "fs";
import chalk from "chalk";
import checkSync from "./check-sync";
import Logger from "./logger";
import {ExitCode} from "./exit-codes";
import logHelp from "./help";
import {version} from "../package.json";
import determineOptions from "./determine-options";
import exit from "./exit";
import setCwd from "./set-cwd";
import {parseArgs} from "./parse-args";

/**
 * Run the command line.
 *
 * @param {string} launchFilePath
 */
export const run = async (launchFilePath: string): Promise<void> => {
    // Configure our logging output and argument parsing.
    chalk.level = 3;

    const log = new Logger(console);
    const args = await parseArgs(log);

    const isValidPath = (arg: string): boolean => {
        // Filter out the node process.
        if (arg === process.execPath) {
            return false;
        }
        // Filter out our entry point.
        if (arg === launchFilePath) {
            return false;
        }
        // Filter out the command that package manager might install.
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
        return true;
    };

    // We filter the set of file paths to verify them.
    const fileSet = new Set(args._);
    for (const file of fileSet) {
        if (!isValidPath(String(file))) {
            fileSet.delete(file);
        }
    }
    args._ = Array.from(fileSet);

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
        setCwd(log, args.cwd);
    }

    // Parse arguments and configurations to get our options.
    return determineOptions(args, log)
        .then(
            (options) => checkSync(options, log),
            (e) => ExitCode.BAD_CONFIG,
        )
        .then(
            (exitCode) => {
                exit(log, exitCode);
            },
            (e) => {
                log.error(`Unexpected error: ${e}`);
                exit(log, ExitCode.CATASTROPHIC);
            },
        );
};
