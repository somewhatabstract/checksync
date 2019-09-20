import chalk from "chalk";

beforeEach(() => {
    // Disable chalk so that colors aren't included in log text.
    chalk.enabled = false;
});

afterEach(() => {
    chalk.enabled = true;
});
