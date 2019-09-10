// @flow
import type {ILog} from "./types.js";
import Logger from "./logger.js";

class StringLoggerInternal implements ILog {
    _buffer: Array<string> = [];
    _errorsLogged: boolean = false;
    _groupIndent: number = 0;

    get errorsLogged(): boolean {
        return this._errorsLogged;
    }

    _log = (...args: Array<string>) => {
        this._buffer.push(`${"  ".repeat(this._groupIndent)}${args.join("")}`);
    };

    getLog = () => this._buffer.join("\n");

    group = (...labels: Array<string>) => {
        this._log("<group>", ...labels);
        this._groupIndent++;
    };

    groupEnd = () => {
        this._groupIndent--;
        this._log("<end_group>");
    };

    log = (message: string): void => this._log(message);
    info = (message: string): void => this._log(message);
    error = (message: string, skipFormat?: boolean): void => {
        this._errorsLogged = true;
        this._log(message);
    };
    warn = (message: string): void => this._log(message);
}

export default class StringLogger extends Logger {
    getLog: () => string;

    constructor() {
        const realLogger = new StringLoggerInternal();
        super(realLogger);
        this.getLog = () => realLogger.getLog();
    }
}
