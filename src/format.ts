import chalk from "chalk";
import cwdRelativePath from "./cwd-relative-path";

enum Label {
    Verbose = "Verbose",
    Error = "Error",
    Info = "Info",
    Warning = "Warning",
    Mismatch = "Mismatch",
    Migrate = "Migrate",
    Fix = "Fix",
}

const labelWidth = Math.max(
    ...Object.values(Label).map((label) => label.length),
);

// MISMATCH is our longest message label.
const asLabel = (label: Label): string =>
    `${label}${" ".repeat(labelWidth - label.length)}`;

const Format = {
    verbose: (text: string): string =>
        `${chalk.grey(asLabel(Label.Verbose))} ${chalk.dim(text)}`,
    error: (text: string): string => {
        if (text.startsWith("Error: ")) {
            text = text.substring("Error: ".length);
        }
        return `${chalk.red(asLabel(Label.Error))} ${text}`;
    },
    info: (text: string): string =>
        `${chalk.blue(asLabel(Label.Info))} ${text}`,
    warn: (text: string): string =>
        `${chalk.yellow(asLabel(Label.Warning))} ${text}`,
    mismatch: (text: string): string =>
        `${chalk.bold.yellowBright(asLabel(Label.Mismatch))} ${text}`,
    migrate: (text: string): string =>
        `${chalk.bold.yellowBright(asLabel(Label.Migrate))} ${text}`,
    fix: (text: string): string =>
        `${chalk.bold.greenBright(asLabel(Label.Fix))} ${text}`,

    cwdFilePath: (filePath: string): string =>
        `${chalk.gray(cwdRelativePath(filePath))}`,
    code: (text: string): string => `${chalk.bold.yellow(text)}`,
    heading: (text: string): string => `${chalk.bold.green(text)}`,
} as const;
export default Format;
