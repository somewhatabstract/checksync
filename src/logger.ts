/**
 * Logging utilities to standardize our output.
 */
import Format from "./format";

import {ILog, IStandardLog} from "./types";

export default class Logging implements ILog {
    _logger: IStandardLog | null | undefined;
    _verbose: boolean;

    constructor(logger?: IStandardLog | null, verbose?: boolean) {
        this._logger = logger;
        this._verbose = !!verbose;
    }

    setVerbose: () => boolean = () => (this._verbose = true);

    group: (...labels: Array<string>) => void = (...labels: Array<string>) => {
        this._logger?.group(...labels);
    };

    groupEnd: () => void = () => {
        this._logger?.groupEnd();
    };

    log: (message: string) => void = (message: string): void => {
        this._logger?.log(message);
    };

    info: (message: string) => void = (message: string): void => {
        this._logger?.info(Format.info(message));
    };

    error: (message: string) => void = (message: string): void => {
        this._logger?.error(Format.error(message));
    };

    warn: (message: string) => void = (message: string): void => {
        this._logger?.warn(Format.warn(message));
    };

    verbose: (messageBuilder: () => string | null | undefined) => void = (
        messageBuilder: () => string | null | undefined,
    ): void => {
        if (this._verbose) {
            const maybeMessage = messageBuilder();
            if (maybeMessage) {
                this.log(Format.verbose(maybeMessage));
            }
        }
    };
}
