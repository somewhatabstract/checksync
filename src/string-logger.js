// @flow
import path from "path";
import Logger from "./logger.js";

/**
 * Rather than directly use this implementation, we wrap it with the main
 * Logger class so that we also capture the format calls as part of the
 * captured output. This allows us to have standardized format whether it is
 * invoked by the Logger implementation or someone calling Format/chalk before
 * passing it to a log call.
 */
class StringLoggerInternal {
    _buffer: Array<string> = [];
    _errorsLogged: boolean = false;
    _groupIndent: number = 0;

    _log = (...args: Array<string>) => {
        /**
         * We want to normalize the string in case it contains filepaths.
         * This ensures that snapshots are standardized across platforms.
         */
        const normalize = (snippet: string): string =>
            snippet.replace(path.sep, "/");
        this._buffer.push(
            `${"  ".repeat(this._groupIndent)}${args.map(normalize).join("")}`,
        );
    };

    getLog = () => this._buffer.join("\n");

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
