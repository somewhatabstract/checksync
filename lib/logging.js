// @flow
/**
 * Logging utilities to standardize our output.
 */
import chalk from "chalk";

import type {ILog} from "./types.js";

export class Logging implements ILog {
    _logger: ILog;

    constructor(logger: ILog = console) {
        if (logger === this) {
            throw new Error("Cannot log to myself");
        }
        this._logger = logger;
    }

    log = (message: string): void => this._logger.log(message);
    info = (message: string): void =>
        this._logger.info(`${chalk.bold.white.bgBlue(" INFO ")} ${message}`);
    error = (message: string): void =>
        this._logger.error(
            `${chalk.bold.white.bgRed(" ERROR ")} ${chalk.red(message)}`,
        );
    warn = (message: string): void =>
        this._logger.warn(
            `${chalk.bold.black.bgYellow(" WARNING ")} ${chalk.yellow(
                message,
            )}`,
        );
}
export const ConsoleLogger = new Logging();
