// @flow
import Format from "./format.js";

import type {ILog, IPositionLog} from "./types.js";

/**
 * Output log entries specific to a file and a location in that file.
 *
 * For the basic calls, we assume line 0 0.
 * Output format:
 *     filename:line:column message
 *
 * @export
 * @class FileReferenceLogger
 * @implements {ILog}
 */
export default class FileReferenceLogger implements IPositionLog {
    _log: ILog;
    _file: string;

    constructor(file: string, log: ILog) {
        this._log = log;
        this._file = file;
    }

    log = (message: string, line?: string | number): void =>
        this._log.log(this._format(message, line));
    info = (message: string, line?: string | number): void =>
        this._log.info(this._format(message, line));
    warn = (message: string, line?: string | number): void =>
        this._log.warn(this._format(message, line));
    error = (message: string, line?: string | number): void =>
        this._log.error(this._format(message, line));
    group = (...labels: Array<string>): void => this._log.group(...labels);
    groupEnd = (): void => this._log.groupEnd();
    verbose = (message: string, line?: string | number): void =>
        this._log.verbose(this._format(message, line));

    _format = (message: string, line?: string | number) =>
        `${this._formatRef(line)} ${message}`;

    _formatRef = (line?: string | number) =>
        Format.cwdFilePath(`${this._file}${(line && `:${line}`) || ""}`);

    get errorsLogged() {
        return this._log.errorsLogged;
    }
}
