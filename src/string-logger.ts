import path from "path";
import escapeRegExp from "lodash/escapeRegExp";
import Logger from "./logger";
import ancesdir from "ancesdir";

import {IStandardLog} from "./types";

const ROOT_DIR = ancesdir();

/**
 * Rather than directly use this implementation, we wrap it with the main
 * Logger class so that we also capture the format calls as part of the
 * captured output. This allows us to have standardized format whether it is
 * invoked by the Logger implementation or someone calling Format/chalk before
 * passing it to a log call.
 */
class StringLoggerInternal implements IStandardLog {
    _buffer: Array<string> = [];
    _groupIndent = 0;

    _log = (...args: Array<string>) => {
        const {sep} = path;
        /**
         * We want to normalize the string in case it contains filepaths.
         * This ensures that snapshots are standardized across platforms.
         *
         * We do two things:
         * - Replace the path separator so that it's platform-independent
         * - Replace the root path so that it's platform-independent
         */
        const sepRegex =
            // If the path separator is a backslash we create a regex that
            // recognizes a double backslash or a single backslash.  This is
            // to handle the escaping from JSON.stringify() in output-json.js.
            // NOTE: This is really naïve; it will also replace the escaping
            // of special characters like newlines (\n) and tabs (\t), on
            // systems where \ is the path separator, which we don't want.
            // For now, messages that might be JSON.stringified shouldn't
            // have those things.
            sep === "\\"
                ? new RegExp(
                      `${escapeRegExp(sep + sep)}|${escapeRegExp(sep)}`,
                      "g",
                  )
                : new RegExp(escapeRegExp(path.sep), "g");
        const rootDirRegex = new RegExp(
            escapeRegExp(ROOT_DIR).replace(sepRegex, "/"),
            "g",
        );

        const normalize = (snippet: string): string =>
            snippet.replace(sepRegex, "/").replace(rootDirRegex, "ROOT_DIR");

        // Trim the trailing whitespace.
        // This means our snapshots are eslint/prettier-fix safe as
        // otherwise, saving a test file could erase just whitespace lines in
        // snapshots.
        const line = `${"  ".repeat(this._groupIndent)}${args
            .map(normalize)
            .join("")}`.trimEnd();
        this._buffer.push(line);
    };

    getLog = (): string => this._buffer.join("\n");

    group = (...labels: Array<string>) => {
        this._log("<group ", ...labels, " >");
        this._groupIndent++;
    };

    groupEnd = () => {
        if (this._groupIndent < 1) {
            return;
        }
        this._groupIndent--;
        this._log("<end_group>");
    };

    log = (message: string): void => this._log(message);
    info = (message: string): void => this._log(message);
    error = (message: string): void => this._log(message);
    warn = (message: string): void => this._log(message);
}

export default class StringLogger extends Logger {
    getLog: () => string;

    constructor(verbose?: boolean) {
        const realLogger = new StringLoggerInternal();
        super(realLogger, verbose);
        this.getLog = () => realLogger.getLog();
    }
}
