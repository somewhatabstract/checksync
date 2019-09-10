// @flow
import chalk from "chalk";

export default {
    error: (text: string) =>
        `${chalk.bold.white.bgRed(" ERROR ")} ${chalk.red(text)}`,
    info: (text: string) => `${chalk.black.bgBlue(" INFO ")} ${text}`,
    warn: (text: string) =>
        `${chalk.bold.black.bgYellow(" WARNING ")} ${chalk.yellow(text)}`,
    violation: (text: string) =>
        `${chalk.bold.black.bgYellowBright(" MISMATCH ")} ${chalk.yellow(
            text,
        )}`,
};
