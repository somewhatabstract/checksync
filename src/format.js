// @flow
import chalk from "chalk";
import cwdRelativePath from "./cwd-relative-path.js";

const Format = {
    verbose: (text: string): string =>
        `${chalk.bold.bgBlack.grey(" VERBOSE ")} ${chalk.dim(text)}`,
    error: (text: string): string =>
        `${chalk.bold.white.bgRed(" ERROR ")} ${text}`,
    info: (text: string): string => `${chalk.black.bgBlue(" INFO ")} ${text}`,
    warn: (text: string): string =>
        `${chalk.bold.black.bgYellow(" WARNING ")} ${text}`,
    mismatch: (text: string): string =>
        `${chalk.bold.black.bgYellowBright(" MISMATCH ")} ${text}`,
    cwdFilePath: (filePath: string): string =>
        chalk.gray(cwdRelativePath(filePath)),

    code: (text: string): string => `${chalk.bold.yellow(text)}`,
    heading: (text: string): string => `${chalk.bold.green(text)}`,
};
export default Format;
