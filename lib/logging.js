// @flow
/**
 * Logging utilities to standardize our output.
 */
import chalk from "chalk";

class Logging {
    static log = (message: string): void => console.log(message);
    static info = (message: string): void =>
        console.info(`${chalk.bold.white.bgBlue(" INFO ")} ${message}`);
    static error = (message: string): void =>
        console.error(
            `${chalk.bold.white.bgRed(" ERROR ")} ${chalk.red(message)}`,
        );
    static warn = (message: string): void =>
        console.warn(
            `${chalk.bold.black.bgYellow(" WARNING ")} ${chalk.yellow(
                message,
            )}`,
        );
}

export default Logging;
