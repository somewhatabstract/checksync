import FileReferenceLogger from "./file-reference-logger";
import maybeReportError from "./maybe-report-error";
import {ExitCode} from "./exit-codes";
import defaultOptions from "./default-options";
import getLaunchString from "./get-launch-string";
import cwdRelativePath from "./cwd-relative-path";
import {version} from "../package.json";
import fixFile from "./fix-file";
import {ErrorCode} from "./error-codes";
import rootRelativePath from "./root-relative-path";

import {ErrorDetails, Options, ILog, ErrorDetailsByDeclaration} from "./types";

type ErrorsByFile = {
    [key: string]: Array<ErrorDetails>;
};

export default class OutputSink {
    _fixableFileNames: Set<string> = new Set();
    _mainLog: ILog;
    _options: Options;
    _errorsByFile: ErrorsByFile = {};
    _filesWithUnfixableErrors: Set<string> = new Set();

    _fileLog: FileReferenceLogger | null | undefined = null;

    constructor(options: Options, log: ILog) {
        this._mainLog = log;
        this._options = options;
    }

    _getErrorsForFile(file: string): Array<ErrorDetails> {
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
            this._filesWithUnfixableErrors.add(fileLog.file);
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
                if (code === ErrorCode.mismatchedChecksum) {
                    fileLog.mismatch(reason, fix.line);
                } else if (code === ErrorCode.pendingMigration) {
                    fileLog.migrate(reason, fix.line);
                } else {
                    fileLog.warn(reason, fix.line);
                }
            }
        }
        this._getErrorsForFile(fileLog.file).push(errorDetails);
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

            // If we are autofixing and we have not encountered any unfixable
            // errors in this file.
            if (
                this._options.autoFix &&
                !this._filesWithUnfixableErrors.has(fileLog.file)
            ) {
                fileLog.verbose(() => "File has errors; skipping auto-fix");
                const errorsForThisFile = this._getErrorsForFile(fileLog.file);
                const fixes =
                    errorsForThisFile.reduce<ErrorDetailsByDeclaration>(
                        (map, e) => {
                            // @ts-expect-error TS doesn't know that because
                            // _unfixableErrors is false, there must be a fix
                            // on each error.
                            const {declaration} = e.fix;
                            const errors = map[declaration] || [];
                            errors.push(e);
                            map[declaration] = errors;
                            return map;
                        },
                        {},
                    );

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
        const commentsArg = [...this._options.comments].sort().join(" ");
        if (commentsArg !== [...defaultOptions.comments].sort().join(" ")) {
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
        if (this._filesWithUnfixableErrors.size > 0) {
            this._mainLog.error(
                this._options.autoFix
                    ? "🛑  Could not update all tags due to unfixable errors. Fix the errors and try again."
                    : "🛑  Unfixable errors found. Fix the errors and try again.",
            );
        }
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
                // Output how to fix any violations we found if we're not
                // running autofix.
                this._mainLog.log("");
                const errorMsg =
                    this._filesWithUnfixableErrors.size > 0
                        ? "🛑  Desynchronized blocks detected and parsing errors were found. Fix the errors, update the blocks, then update the sync-start tags using:"
                        : "🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:";
                this._mainLog.group(`${errorMsg}`);
                this._mainLog.log("");
                this._mainLog.log(this._getFullLaunchString());
                this._mainLog.groupEnd();
            } else if (this._options.dryRun) {
                // It's a dry run, and autoFix must be true so let's output
                // something helpful.
                this._mainLog.log("");
                this._mainLog.group(
                    `${this._fixableFileNames.size} file(s) would have been fixed.\nTo fix, run:`,
                );
                this._mainLog.log(this._getFullLaunchString());
                this._mainLog.groupEnd();
            } else {
                // If we got here, auto-fixing must be turned on, we must've
                // fixed something and it's not a dry run.
                // Output a summary of what we fixed.
                this._mainLog.info(
                    `Fixed issues in ${this._fixableFileNames.size} file(s)`,
                );
            }
        }

        // Now let's report on files we didn't fix because they contain
        // parse errors (parse errors mean we have to assume our potential
        // fixes are unreliable).
        if (this._filesWithUnfixableErrors.size > 0) {
            this._mainLog.log("");
            this._mainLog.group(
                this._options.autoFix
                    ? "🛑  Could not update all tags due to unfixable errors. Fix the errors in these files and try again."
                    : "🛑  Unfixable errors found. Fix the errors in these files and try again.",
            );
            this._mainLog.log(
                Array.from(this._filesWithUnfixableErrors)
                    .map(cwdRelativePath)
                    .join("\n"),
            );
            this._mainLog.groupEnd();
        }
    }

    end(): ExitCode {
        if (this._options.json) {
            this._outputJson();
        } else {
            this._outputText();
        }

        // Determine the exit code.
        if (this._filesWithUnfixableErrors.size > 0) {
            return ExitCode.PARSE_ERRORS;
        }
        if (this._fixableFileNames.size > 0 && !this._options.autoFix) {
            // We have files that can be fixed and we aren't autofixing them
            // so report desynchronized blocks.
            return ExitCode.DESYNCHRONIZED_BLOCKS;
        }

        if (!this._options.json) {
            // If we get here, everything worked.
            this._mainLog.log("🎉  Everything is in sync!");
        }
        return ExitCode.SUCCESS;
    }
}
