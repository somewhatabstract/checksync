// @flow
/**
 * Logging utilities to standardize our output.
 */
import chalk from "chalk";

import type {ILog} from "./types.js";

export class Logging implements ILog {
    _logger: ?ILog;

    constructor(logger: ?ILog) {
        this._logger = logger;
    }

    log = (message: string): void => {
        this._logger && this._logger.log(message);
    };
    info = (message: string): void => {
        this._logger &&
            this._logger.info(
                `${chalk.bold.white.bgBlue(" INFO ")} ${message}`,
            );
    };
    error = (message: string): void => {
        this._logger &&
            this._logger.error(
                `${chalk.bold.white.bgRed(" ERROR ")} ${chalk.red(message)}`,
            );
    };
    warn = (message: string): void => {
        this._logger &&
            this._logger.warn(
                `${chalk.bold.black.bgYellow(" WARNING ")} ${chalk.yellow(
                    message,
                )}`,
            );
    };
}

export const NullLogger = new Logging();
export const ConsoleLogger = new Logging(console);
