// @flow
/**
 * Logging utilities to standardize our output.
 */
import Format from "./format.js";

import type {ILog} from "./types.js";

type MissingInStandardLog = {
    +errorsLogged: boolean,
    +verbose: (() => string) => void,
    +violation: (message: string) => void,
    +mute: () => void,
    +unmute: () => void,
};
type StandardLog = $Diff<ILog, MissingInStandardLog>;
type StandardLogReadOnly = $ReadOnly<StandardLog>;

export default class Logging implements ILog {
    _logger: ?StandardLogReadOnly;
    _verbose: boolean;
    _errorsLogged: boolean;
    _silent: boolean;

    constructor(logger: ?StandardLogReadOnly, verbose?: boolean) {
        this._logger = logger;
        this._errorsLogged = false;
        this._verbose = !!verbose;
        this._silent = false;
    }

    setVerbose: () => boolean = () => (this._verbose = true);

    get errorsLogged(): boolean {
        return this._errorsLogged;
    }

    group: (...labels: Array<string>) => void = (...labels: Array<string>) => {
        !this._silent && this._logger && this._logger.group(...labels);
    };

    groupEnd: () => void = () => {
        !this._silent && this._logger && this._logger.groupEnd();
    };

    log: (message: string) => void = (message: string): void => {
        !this._silent && this._logger && this._logger.log(message);
    };

    info: (message: string) => void = (message: string): void => {
        !this._silent &&
            this._logger &&
            this._logger.info(Format.info(message));
    };

    error: (message: string) => void = (message: string): void => {
        this._errorsLogged = true;
        !this._silent &&
            this._logger &&
            this._logger.error(Format.error(message));
    };

    violation: (message: string) => void = (message: string): void => {
        !this._silent &&
            this._logger &&
            this._logger.log(Format.violation(message));
    };

    warn: (message: string) => void = (message: string): void => {
        !this._silent &&
            this._logger &&
            this._logger.warn(Format.warn(message));
    };

    verbose: (messageBuilder: () => string) => void = (
        messageBuilder: () => string,
    ): void => {
        !this._silent &&
            this._verbose &&
            this.log(Format.verbose(messageBuilder()));
    };

    mute: () => void = () => {
        this._silent = true;
    };

    unmute: () => void = () => {
        this._silent = false;
    };
}
