// @flow
import path from "path";
import chalk from "chalk";
import StringLogger from "../string-logger.js";

import checkSync from "../check-sync.js";

describe("Integration Tests", () => {
    beforeEach(() => {
        chalk.enabled = false;
    });

    afterEach(() => {
        chalk.enabled = true;
    });

    it("should report __examples__ violations", async () => {
        // Arrange
        const stringLogger = new StringLogger();

        // Act
        await checkSync(
            [path.join(__dirname, "../../__examples__")],
            false,
            ["//", "#"],
            stringLogger,
        );
        const result = stringLogger.getLog();

        // Assert
        expect(result).toMatchSnapshot("__examples__");
    });

    it("should report __examples__ parse errors with autoFix", async () => {
        // Arrange
        const stringLogger = new StringLogger();

        // Act
        await checkSync(
            [path.join(__dirname, "../../__examples__")],
            true,
            ["//", "#"],
            stringLogger,
        );
        const result = stringLogger.getLog();

        // Assert
        expect(result).toMatchSnapshot("__examples__ autofix");
    });
});
