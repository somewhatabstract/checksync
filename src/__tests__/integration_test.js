// @flow
import path from "path";
import StringLogger from "../string-logger.js";

import checkSync from "../check-sync.js";

describe("Integration Tests", () => {
    it("should report __examples__ violations", async () => {
        // Arrange
        const stringLogger = new StringLogger();

        // Act
        await checkSync(
            {
                includeGlobs: [path.join(__dirname, "../../__examples__")],
                autoFix: false,
                comments: ["//", "#"],
                dryRun: false,
                excludeGlobs: ["**/excluded/**"],
            },
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
            {
                includeGlobs: [path.join(__dirname, "../../__examples__")],
                autoFix: true,
                comments: ["//", "#"],
                dryRun: true,
                excludeGlobs: ["**/excluded/**"],
            },
            stringLogger,
        );
        const result = stringLogger.getLog();

        // Assert
        expect(result).toMatchSnapshot("__examples__ autofix");
    });
});
