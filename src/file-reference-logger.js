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

    get file(): string {
        return this._file;
    }

    mismatch: (message: string, line?: string | number) => void = (
        message: string,
        line?: string | number,
    ): void => this._log.log(Format.mismatch(this._format(message, line)));
    fix: (message: string, line?: string | number) => void = (
        message: string,
        line?: string | number,
    ): void => this._log.log(Format.fix(this._format(message, line)));
    log: (message: string, line?: string | number) => void = (
        message: string,
        line?: string | number,
    ): void => this._log.log(this._format(message, line));
    info: (message: string, line?: string | number) => void = (
        message: string,
        line?: string | number,
    ): void => this._log.info(this._format(message, line));
    warn: (message: string, line?: string | number) => void = (
        message: string,
        line?: string | number,
    ): void => this._log.warn(this._format(message, line));
    error: (message: string, line?: string | number) => void = (
        message: string,
        line?: string | number,
    ): void => this._log.error(this._format(message, line));
    group: (...labels: Array<string>) => void = (
        ...labels: Array<string>
    ): void => this._log.group(...labels);
    groupEnd: () => void = (): void => this._log.groupEnd();
    verbose: (messageBuilder: () => ?string, line?: string | number) => void = (
        messageBuilder: () => ?string,
        line?: string | number,
    ): void =>
        this._log.verbose(() => {
            const maybeMessage = messageBuilder();
            return maybeMessage ? this._format(maybeMessage, line) : null;
        });

    _format: (message: string, line?: string | number) => string = (
        message: string,
        line?: string | number,
    ) => `${this._formatRef(line)} ${message}`;

    _formatRef: (line?: string | number) => string = (line?: string | number) =>
        Format.cwdFilePath(`${this._file}${(line && `:${line}`) || ""}`);
}
