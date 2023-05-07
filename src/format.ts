import chalk from "chalk";
import cwdRelativePath from "./cwd-relative-path";

// MISMATCH is our longest message label.
const labelWidth = "Mismatch ".length;
const asLabel = (label: string): string =>
    `${" ".repeat(labelWidth - label.length)}${label} `;

const Format = {
    verbose: (text: string): string =>
        `${chalk.grey(asLabel("Verbose"))} ${chalk.dim(text)}`,
    error: (text: string): string => `${chalk.red(asLabel("Error"))} ${text}`,
    info: (text: string): string => `${chalk.blue(asLabel("Info"))} ${text}`,
    warn: (text: string): string =>
        `${chalk.yellow(asLabel("Warning"))} ${text}`,
    mismatch: (text: string): string =>
        `${chalk.bold.yellowBright(asLabel("Mismatch"))} ${text}`,
    fix: (text: string): string =>
        `${chalk.bold.greenBright(asLabel("Fix"))} ${text}`,

    cwdFilePath: (filePath: string): string =>
        `${chalk.gray(cwdRelativePath(filePath))}`,
    code: (text: string): string => `${chalk.bold.yellow(text)}`,
    heading: (text: string): string => `${chalk.bold.green(text)}`,
} as const;
export default Format;
