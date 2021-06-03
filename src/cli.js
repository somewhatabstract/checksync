// @flow
/**
 * The implementation of our command line utility.
 */
import fs from "fs";
import path from "path";
import chalk from "chalk";
import minimist from "minimist";
import checkSync from "./check-sync.js";
import Logger from "./logger.js";
import ErrorCodes from "./error-codes.js";
import logHelp from "./help.js";
import defaultArgs from "./default-args.js";
import parseGitIgnore from "parse-gitignore";
import {version} from "../package.json";

const ignoreFilesToExcludes = (ignoreFilesArg: string): Array<string> => {
    const ignoreFiles = ignoreFilesArg.split(",").filter((c) => !!c);
    if (
        ignoreFilesArg === defaultArgs.ignoreFiles &&
        !fs.existsSync(ignoreFilesArg)
    ) {
        return [];
    }

    return ignoreFiles
        .map((file) => fs.readFileSync(file))
        .map((content: Buffer) => parseGitIgnore(content))
        .reduce((prev, current: Array<string>) => [...prev, ...current], []);
};

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
                const realpath = path.resolve(fs.readlinkSync(arg));
                if (realpath == launchFilePath) return false;
            } catch {
                /* ignore errors, the arg may not be a path at all */
            }

            if (arg.startsWith("-")) {
                log.error(`Unknown argument: ${arg}`);
                process.exit(ErrorCodes.UNKNOWN_ARGS);
            }
            return true;
        },
    });

    if (args.version) {
        log.log(version);
        process.exit(ErrorCodes.SUCCESS);
    }

    if (args.help) {
        logHelp(log);
        process.exit(ErrorCodes.SUCCESS);
    }

    if (args.verbose) {
        log.setVerbose();
    }
    log.verbose(
        () => `Launched with args: ${JSON.stringify(args, null, "    ")}`,
    );

    const comments = ((args.comments: any): string)
        .split(",")
        .filter((c) => !!c);
    const ignoreGlobs = ((args.ignore: any): string)
        .split(",")
        .filter((c) => !!c);

    const ignoreFileGlobs = args.noIgnoreFile
        ? []
        : ignoreFilesToExcludes((args.ignoreFiles: any));
    const excludeGlobs = [...ignoreGlobs, ...ignoreFileGlobs];

    // Make sure we have something to search, so default to current working
    // directory if no globs are given.
    const includeGlobs = args._ && args._.length > 0 ? args._ : [process.cwd()];

    checkSync(
        {
            includeGlobs,
            excludeGlobs,
            autoFix: args.updateTags === true,
            json: args.json === true,
            comments,
            rootMarker: (args.rootMarker: any),
            dryRun: args.dryRun === true,
        },
        log,
    ).then((exitCode) => {
        log.verbose(() => `Exiting with code ${exitCode}`);
        process.exit(exitCode);
    });
};
