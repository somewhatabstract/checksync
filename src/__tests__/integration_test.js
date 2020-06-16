// @flow
import fs from "fs";
import path from "path";
import ancesdir from "ancesdir";
import StringLogger from "../string-logger.js";

import checkSync from "../check-sync.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("Integration Tests", () => {
    const getExampleDirs = () => {
        const __examples__ = path.join(ancesdir(), "__examples__");
        return fs
            .readdirSync(__examples__)
            .map((name) => [name, path.join(__examples__, name)])
            .filter(([_, dirPath]) => fs.lstatSync(dirPath).isDirectory());
    };
    const exampleDirs = getExampleDirs();

    it.each(exampleDirs)(
        "should report example %s to match snapshot",
        async (name, dirPath) => {
            // Arrange
            const stringLogger = new StringLogger();

            // Act
            await checkSync(
                {
                    includeGlobs: [dirPath],
                    autoFix: false,
                    comments: ["//", "#", "{/*"],
                    dryRun: false,
                    excludeGlobs: ["**/excluded/**"],
                },
                stringLogger,
            );
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );

    it.each(exampleDirs)(
        "should report example %s to match snapshot with autofix dryrun",
        async (name, dirPath) => {
            // Arrange
            const stringLogger = new StringLogger();

            // Act
            await checkSync(
                {
                    includeGlobs: [dirPath],
                    autoFix: true,
                    comments: ["//", "#", "{/*"],
                    dryRun: true,
                    excludeGlobs: ["**/excluded/**"],
                },
                stringLogger,
            );
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );
});
