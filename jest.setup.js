import chalk from "chalk";

let chalkLevel = 0;

beforeEach(() => {
    // Disable chalk so that colors aren't included in log text.
    chalkLevel = chalk.level;
    chalk.level = 0;
});

afterEach(() => {
    // Reset chalk level.
    chalk.level = chalkLevel;
});
