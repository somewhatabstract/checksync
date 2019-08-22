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
        console.error(`${chalk.bold.bgRed(" ERROR ")} ${chalk.red(message)}`);
}

export default Logging;
