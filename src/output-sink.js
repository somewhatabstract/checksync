// @flow
import FileReferenceLogger from "./file-reference-logger.js";
import maybeReportError from "./maybe-report-error.js";
import ExitCodes from "./exit-codes.js";
import defaultArgs from "./default-args.js";
import getLaunchString from "./get-launch-string.js";
import cwdRelativePath from "./cwd-relative-path.js";
import {version} from "../package.json";
import fixFile from "./fix-file.js";

import type {ExitCode} from "./exit-codes.js";
import type {
    ErrorDetailsByDeclaration,
    ErrorDetails,
    Options,
    ILog,
} from "./types.js";

export default class OutputSink {
    _fixableFileNames: Set<string> = new Set();
    _mainLog: ILog;
    _options: Options;
    _errorDetailsByFileAndLine: {
        [key: string]: ErrorDetailsByDeclaration,
        ...
    } = {};

    _fileLog: ?FileReferenceLogger = null;

    constructor(options: Options, log: ILog) {
        this._mainLog = log;
        this._options = options;
    }

    startFile(file: string): void {
        if (this._fileLog != null) {
            throw new Error(
                "Cannot start processing a file while already processing another",
            );
        }
        if (this._errorDetailsByFileAndLine[file] != null) {
            throw new Error("File has already been drained to the output sink");
        }
        this._fileLog = new FileReferenceLogger(file, this._mainLog);
        this._errorDetailsByFileAndLine[file] = {};
    }

    processError(errorDetails: ErrorDetails): void {
        const fileLog = this._fileLog;
        if (fileLog == null) {
            throw new Error(
                "Cannot process errors before file processing has started",
            );
        }

        // This reports errors that are not "fixable".
        maybeReportError(fileLog, errorDetails);

        // Now we determine if we need to track or report the problem.
        const {fix, reason} = errorDetails;
        if (fix != null) {
            this._fixableFileNames.add(fileLog.file);

            if (!this._options.autoFix && !this._options.json) {
                fileLog.mismatch(reason);
            } else {
                // NOTE: With the way we now support multiline fixes in our
                // data types, there is the possibility of multiple fixable
                // errors on the same line and possibly fixable errors that
                // intersect.
                // We currently don't support those, but if we started to,
                // we would want to work out what to do here.
                this._errorDetailsByFileAndLine[fileLog.file][fix.declaration] =
                    errorDetails;
            }
        }
    }

    async endFile(): Promise<void> {
        const fileLog = this._fileLog;
        if (fileLog == null) {
            throw new Error(
                "Cannot end processing a file before file processing has started",
            );
        }
        try {
            if (this._options.autoFix) {
                // We need to apply fixes, unless it's a dry-run.
                // We can hand this over to a different
                await fixFile(
                    this._options,
                    fileLog.file,
                    fileLog,
                    this._errorDetailsByFileAndLine[fileLog.file],
                );
            }
        } finally {
            this._fileLog = null;
        }
    }

    _getFullLaunchString(): string {
        /**
         * There are some arguments we need to include to ensure that the launch
         * string we output would work.
         *
         * We don't care about ignore files, because we're giving a list of specific
         * files, but we do care about:
         *  - comment matchers
         *  - the root marker
         */
        const updateCommandParts = [];
        updateCommandParts.push(getLaunchString());
        const commentsArg = this._options.comments.sort().join(",");
        if (commentsArg !== defaultArgs.comments) {
            updateCommandParts.push("-c");
            updateCommandParts.push(`"${commentsArg}"`);
        }
        const rootMarker = this._options.rootMarker;
        if (rootMarker != null) {
            updateCommandParts.push("-m");
            updateCommandParts.push(`"${rootMarker}"`);
        }
        updateCommandParts.push("-u");
        updateCommandParts.push(
            Array.from(this._fixableFileNames).map(cwdRelativePath).join(" "),
        );

        return updateCommandParts.join(" ");
    }

    _outputJson(): ExitCode {
        const items = {
            /* TODO */
        };
        this._mainLog.log(
            JSON.stringify(
                {
                    version,
                    launchString: this._getFullLaunchString(),
                    items,
                },
                null,
                4,
            ),
        );
        return ExitCodes.SUCCESS;
    }

    _outputText(): ExitCode {
        if (this._fixableFileNames.size > 0) {
            if (this._options.autoFix) {
                if (this._options.dryRun) {
                    this._mainLog.group(
                        `${this._fixableFileNames.size} file(s) would have been fixed. To fix, run:`,
                    );
                    this._mainLog.log("");
                    this._mainLog.log(this._getFullLaunchString());
                    this._mainLog.groupEnd();
                } else {
                    // Output a summary of what we fixed.
                    this._mainLog.info(
                        `Fixed ${this._fixableFileNames.size} file(s)`,
                    );
                }
            } else {
                // Output how to fix any violations we found if we're not running
                // autofix.
                this._mainLog.log("");
                const errorMsg = this._mainLog.errorsLogged
                    ? "🛑  Desynchronized blocks detected and parsing errors found. Fix the errors, update the blocks, then update the sync-start tags using:"
                    : "🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:";
                this._mainLog.group(`${errorMsg}`);
                this._mainLog.log("");
                this._mainLog.log(this._getFullLaunchString());
                this._mainLog.groupEnd();
                return ExitCodes.DESYNCHRONIZED_BLOCKS;
            }
        }

        if (this._mainLog.errorsLogged) {
            this._mainLog.log("🛑  Errors occurred during processing");
            return ExitCodes.PARSE_ERRORS;
        }

        this._mainLog.log("🎉  Everything is in sync!");
        return ExitCodes.SUCCESS;
    }

    end(): ExitCode {
        if (this._options.json) {
            return this._outputJson();
        }

        return this._outputText();
    }
}
