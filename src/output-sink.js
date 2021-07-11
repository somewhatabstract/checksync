// @flow
import FileReferenceLogger from "./file-reference-logger.js";
import maybeReportError from "./maybe-report-error.js";
import ExitCodes from "./exit-codes.js";
import defaultArgs from "./default-args.js";
import getLaunchString from "./get-launch-string.js";
import cwdRelativePath from "./cwd-relative-path.js";
import {version} from "../package.json";
import fixFile from "./fix-file.js";
import ErrorCodes from "./error-codes.js";
import rootRelativePath from "./root-relative-path.js";

import type {ExitCode} from "./exit-codes.js";
import type {ErrorDetails, Options, ILog} from "./types.js";

type ErrorsByFile = {
    [key: string]: Array<ErrorDetails>,
    ...
};

export default class OutputSink {
    _fixableFileNames: Set<string> = new Set();
    _mainLog: ILog;
    _options: Options;
    _errorsByFile: ErrorsByFile = {};
    _unfixableErrors: boolean = false;

    _fileLog: ?FileReferenceLogger = null;

    constructor(options: Options, log: ILog) {
        this._mainLog = log;
        this._options = options;
    }

    _getErrorsForFile(file: string): ?Array<ErrorDetails> {
        return this._errorsByFile[
            rootRelativePath(file, this._options.rootMarker)
        ];
    }

    _initErrorsForFile(file: string): void {
        this._errorsByFile[rootRelativePath(file, this._options.rootMarker)] =
            [];
    }

    _cleanUpErrorlessFile(file: string): boolean {
        const relativePath = rootRelativePath(file, this._options.rootMarker);
        if (this._errorsByFile[relativePath].length === 0) {
            delete this._errorsByFile[relativePath];
            return true;
        }
        return false;
    }

    startFile(file: string): void {
        if (this._fileLog != null) {
            throw new Error(
                "Cannot start processing a file while already processing another",
            );
        }
        if (this._getErrorsForFile(file) != null) {
            throw new Error("File has already been drained to the output sink");
        }
        this._fileLog = new FileReferenceLogger(file, this._mainLog);
        this._initErrorsForFile(file);
    }

    processError(errorDetails: ErrorDetails): void {
        const fileLog = this._fileLog;
        if (fileLog == null) {
            throw new Error(
                "Cannot process errors before file processing has started",
            );
        }

        if (errorDetails.fix == null) {
            this._unfixableErrors = true;
        }

        // We don't report errors if we're in JSON output mode.
        if (!this._options.json) {
            // This reports errors that are not "fixable".
            maybeReportError(fileLog, errorDetails);
        }

        // Now we determine if we need to track or report the problem.
        const {fix, reason, code} = errorDetails;
        if (fix != null) {
            this._fixableFileNames.add(fileLog.file);

            if (!this._options.autoFix && !this._options.json) {
                if (code === ErrorCodes.mismatchedChecksum) {
                    fileLog.mismatch(reason, fix.line);
                } else {
                    fileLog.warn(reason, fix.line);
                }
            }
        }
        this._getErrorsForFile(fileLog.file)?.push(errorDetails);
    }

    async endFile(): Promise<void> {
        const fileLog = this._fileLog;
        if (fileLog == null) {
            throw new Error(
                "Cannot end processing a file before file processing has started",
            );
        }
        try {
            // No point doing work if there's no work to be done.
            // This also ensures our JSON doesn't output empty info.
            if (this._cleanUpErrorlessFile(fileLog.file)) {
                return;
            }

            // If we are autofixing and we have not encounted any unfixable
            // errors.
            if (this._options.autoFix && !this._unfixableErrors) {
                const errorsForThisFile = this._getErrorsForFile(fileLog.file);
                const fixes = errorsForThisFile?.reduce((map, e) => {
                    if (e.fix != null) {
                        const {declaration} = e.fix;
                        const errors = map[declaration] || [];
                        errors.push(e);
                        map[declaration] = errors;
                    }
                    return map;
                }, {});
                if (fixes == null) {
                    return;
                }

                // We need to apply fixes, unless it's a dry-run.
                // We can hand this over to a different
                await fixFile(this._options, fileLog.file, fileLog, fixes);
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
        const commentsArg = this._options.comments.sort().join(" ");
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

    _outputJson(): void {
        this._mainLog.log(
            JSON.stringify(
                {
                    version,
                    launchString: this._getFullLaunchString(),
                    files: this._errorsByFile,
                },
                null,
                4,
            ),
        );
    }

    _outputText(): void {
        if (this._fixableFileNames.size > 0) {
            if (!this._options.autoFix) {
                // Output how to fix any violations we found if we're not running
                // autofix.
                this._mainLog.log("");
                const errorMsg = this._unfixableErrors
                    ? "🛑  Desynchronized blocks detected and parsing errors were found. Fix the errors, update the blocks, then update the sync-start tags using:"
                    : "🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:";
                this._mainLog.group(`${errorMsg}`);
                this._mainLog.log("");
                this._mainLog.log(this._getFullLaunchString());
                this._mainLog.groupEnd();
                return;
            }

            if (this._options.dryRun) {
                // It's a dry run, let's output something helpful.
                this._mainLog.group(
                    `${this._fixableFileNames.size} file(s) would have been fixed. To fix, run:`,
                );
                this._mainLog.log("");
                this._mainLog.log(this._getFullLaunchString());
                this._mainLog.groupEnd();
                return;
            }

            // Output a summary of what we fixed.
            this._mainLog.info(`Fixed ${this._fixableFileNames.size} file(s)`);
        }

        if (this._unfixableErrors) {
            // Sometimes we still have errors to report.
            this._mainLog.log(
                "🛑  Errors occurred during processing. Fix the errors and try again.",
            );
            return;
        }

        // If we get here, everything worked.
        this._mainLog.log("🎉  Everything is in sync!");
    }

    end(): ExitCode {
        if (this._options.json) {
            this._outputJson();
        } else {
            this._outputText();
        }

        // Determine the exit code.
        if (this._unfixableErrors) {
            if (this._options.autoFix) {
                // We can't fix these, there were non-fixable errors in
                // this file.
                this._mainLog.error(
                    "🛑  Could not update all tags due to non-fixable errors. Fix these errors and try again.",
                );
            }
            return ExitCodes.PARSE_ERRORS;
        } else if (this._fixableFileNames.size > 0 && !this._options.autoFix) {
            // We have files that can be fixed and we aren't autofixing them
            // so report desynchronized blocks.
            return ExitCodes.DESYNCHRONIZED_BLOCKS;
        }
        return ExitCodes.SUCCESS;
    }
}
