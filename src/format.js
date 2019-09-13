// @flow
import chalk from "chalk";
import cwdRelativePath from "./cwd-relative-path.js";

export default {
    error: (text: string) => `${chalk.bold.white.bgRed(" ERROR ")} ${text}`,
    info: (text: string) => `${chalk.black.bgBlue(" INFO ")} ${text}`,
    warn: (text: string) => `${chalk.bold.black.bgYellow(" WARNING ")} ${text}`,
    violation: (text: string) =>
        `${chalk.bold.black.bgYellowBright(" MISMATCH ")} ${text}`,
    filePath: (filePath: string) => chalk.gray(cwdRelativePath(filePath)),
};
