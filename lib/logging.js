// @flow
/**
 * Logging utilities to standardize our output.
 */
import Format from "./format.js";

import type {ILog} from "./types.js";

export class Logging implements ILog {
    _logger: ?ILog;

    constructor(logger: ?ILog) {
        this._logger = logger;
    }

    group = (...labels: Array<string>) => {
        this._logger && this._logger.group(...labels);
    };

    groupEnd = () => {
        this._logger && this._logger.groupEnd();
    };

    log = (message: string): void => {
        this._logger && this._logger.log(message);
    };
    info = (message: string): void => {
        this._logger && this._logger.info(Format.info(message));
    };
    error = (message: string): void => {
        this._logger && this._logger.error(Format.error(message));
    };
    warn = (message: string): void => {
        this._logger && this._logger.warn(Format.warn(message));
    };
}

export const NullLogger = new Logging();
export const ConsoleLogger = new Logging(console);
