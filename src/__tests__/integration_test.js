// @flow
import fs from "fs";
import path from "path";
import ancesdir from "ancesdir";
import StringLogger from "../string-logger.js";

import checkSync from "../check-sync.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("Integration Tests (see __examples__ folder)", () => {
    beforeEach(() => {
        // Fast Glob will hang if we don't do this.
        jest.useRealTimers();
    });

    // Determine the examples folder path and set that as the working directory
    const __examples__ = path.join(ancesdir(), "__examples__");
    process.chdir(__examples__);

    // Iterate over the __examples__ folders and determine eaches glob pattern.
    const exampleGlobs = fs
        .readdirSync(__examples__)
        /**
         * The whole symlink test is not going to work right on windows
         * so let's just skip it.
         */
        .filter((p) => !(process.platform === "win32" && p.includes("symlink")))
        .filter((name) => fs.lstatSync(name).isDirectory())
        // Finally, this has to be an actual glob, or it won't work.
        .map((name) => [name, `${name}/**`])
        .sort();

    it.each(exampleGlobs)(
        "should report example %s to match snapshot",
        async (name, glob) => {
            // Arrange
            const stringLogger = new StringLogger();

            // Act
            await checkSync(
                {
                    includeGlobs: [glob],
                    autoFix: false,
                    comments: ["//", "#", "{/*"],
                    dryRun: false,
                    excludeGlobs: ["**/excluded/**"],
                    ignoreFiles: [],
                    json: false,
                },
                stringLogger,
            );
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );

    it.each(exampleGlobs)(
        "should report example %s to match snapshot with autofix dryrun",
        async (name, glob) => {
            // Arrange
            const stringLogger = new StringLogger();

            // Act
            await checkSync(
                {
                    includeGlobs: [glob],
                    autoFix: true,
                    comments: ["//", "#", "{/*"],
                    dryRun: true,
                    excludeGlobs: ["**/excluded/**"],
                    ignoreFiles: [],
                    json: false,
                },
                stringLogger,
            );
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );

    it.each(exampleGlobs)(
        "should report example %s to match snapshot with json",
        async (name, glob) => {
            // Arrange
            const stringLogger = new StringLogger();

            // Act
            await checkSync(
                {
                    includeGlobs: [glob],
                    autoFix: false,
                    comments: ["//", "#", "{/*"],
                    dryRun: false,
                    excludeGlobs: ["**/excluded/**"],
                    ignoreFiles: [],
                    json: true,
                },
                stringLogger,
            );
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );
});
