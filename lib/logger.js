// @flow
/**
 * Logging utilities to standardize our output.
 */
import Format from "./format.js";

import type {ILog} from "./types.js";

type StandardLog = $ReadOnly<$Diff<ILog, {+errorsLogged: boolean}>>;

export default class Logging implements ILog {
    _logger: ?StandardLog;
    _errorsLogged: boolean;

    constructor(logger: ?StandardLog) {
        this._logger = logger;
        this._errorsLogged = false;
    }

    get errorsLogged(): boolean {
        return this._errorsLogged;
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

    error = (message: string, skipFormat?: boolean): void => {
        this._errorsLogged = true;
        this._logger &&
            this._logger.error(skipFormat ? message : Format.error(message));
    };

    warn = (message: string): void => {
        this._logger && this._logger.warn(Format.warn(message));
    };
}
