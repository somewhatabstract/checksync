// @flow
import fs from "fs";
import path from "path";
import ancesdir from "ancesdir";
import StringLogger from "../string-logger.js";

import checkSync from "../check-sync.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("Integration Tests", () => {
    const getExampleGlobs = () => {
        const __examples__ = path.join(ancesdir(), "__examples__");
        return (
            fs
                .readdirSync(__examples__)
                .map((name) => [name, path.join(__examples__, name)])
                .filter(([_, dirPath]) => fs.lstatSync(dirPath).isDirectory())
                // Globs use forward slashes and we need to strip off the root
                // to make sure this works for Windows.
                .map(([name, dirPath]) => [
                    name,
                    dirPath.replace(ancesdir(), ".").replace(path.sep, "/"),
                ])
        );
    };
    const exampleGlobs = getExampleGlobs();
    console.log(exampleGlobs);

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
                },
                stringLogger,
            );
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );
});
