// @flow
/**
 * Logging utilities to standardize our output.
 */
import Format from "./format.js";

import type {ILog} from "./types.js";

type MissingInStandardLog = {
    +errorsLogged: boolean,
    +verbose: string => void,
};
type StandardLog = $Diff<ILog, MissingInStandardLog>;
type StandardLogReadOnly = $ReadOnly<StandardLog>;

export default class Logging implements ILog {
    _logger: ?StandardLogReadOnly;
    _verbose: boolean;
    _errorsLogged: boolean;

    constructor(logger: ?StandardLogReadOnly, verbose?: boolean) {
        this._logger = logger;
        this._errorsLogged = false;
        this._verbose = !!verbose;
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

    error = (message: string): void => {
        this._errorsLogged = true;
        this._logger && this._logger.error(Format.error(message));
    };

    warn = (message: string): void => {
        this._logger && this._logger.warn(Format.warn(message));
    };

    verbose = (message: string): void => {
        this._verbose && this.log(Format.verbose(message));
    };
}
