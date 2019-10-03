// @flow
import chalk from "chalk";
import cwdRelativePath from "./cwd-relative-path.js";

const Format = {
    verbose: (text: string) => `${chalk.dim(text)}`,
    error: (text: string) => `${chalk.bold.white.bgRed(" ERROR ")} ${text}`,
    info: (text: string) => `${chalk.black.bgBlue(" INFO ")} ${text}`,
    warn: (text: string) => `${chalk.bold.black.bgYellow(" WARNING ")} ${text}`,
    violation: (text: string) =>
        `${chalk.bold.black.bgYellowBright(" MISMATCH ")} ${text}`,
    cwdFilePath: (filePath: string) => chalk.gray(cwdRelativePath(filePath)),

    code: (text: string) => `${chalk.bold.yellow(text)}`,
    heading: (text: string) => `${chalk.bold.green(text)}`,
};
export default Format;
