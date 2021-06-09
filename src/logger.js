// @flow
/**
 * Logging utilities to standardize our output.
 */
import Format from "./format.js";

import type {ILog, IStandardLog} from "./types.js";

export default class Logging implements ILog {
    _logger: ?IStandardLog;
    _verbose: boolean;

    constructor(logger: ?IStandardLog, verbose?: boolean) {
        this._logger = logger;
        this._verbose = !!verbose;
    }

    setVerbose: () => boolean = () => (this._verbose = true);

    group: (...labels: Array<string>) => void = (...labels: Array<string>) => {
        this._logger && this._logger.group(...labels);
    };

    groupEnd: () => void = () => {
        this._logger && this._logger.groupEnd();
    };

    log: (message: string) => void = (message: string): void => {
        this._logger && this._logger.log(message);
    };

    info: (message: string) => void = (message: string): void => {
        this._logger && this._logger.info(Format.info(message));
    };

    error: (message: string) => void = (message: string): void => {
        this._logger && this._logger.error(Format.error(message));
    };

    warn: (message: string) => void = (message: string): void => {
        this._logger && this._logger.warn(Format.warn(message));
    };

    verbose: (messageBuilder: () => string) => void = (
        messageBuilder: () => string,
    ): void => {
        this._verbose && this.log(Format.verbose(messageBuilder()));
    };
}
