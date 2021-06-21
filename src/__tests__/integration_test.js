// @flow
import fs from "fs";
import path from "path";
import ancesdir from "ancesdir";
import escapeRegExp from "lodash/escapeRegExp";
import StringLogger from "../string-logger.js";

import checkSync from "../check-sync.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("Integration Tests", () => {
    const getExampleGlobs = () => {
        const __examples__ = path.join(ancesdir(), "__examples__");
        return (
            fs
                .readdirSync(__examples__)
                /**
                 * The whole symlink test is not going to work right on windows
                 * so let's just skip it.
                 */
                .filter(
                    (p) =>
                        !(
                            process.platform === "win32" &&
                            p.includes("symlink")
                        ),
                )
                .map((name) => [name, path.join(__examples__, name)])
                .filter(([_, dirPath]) => fs.lstatSync(dirPath).isDirectory())
                // Globs use forward slashes and we need to strip off the root
                // to make sure this works for Windows.
                .map(([name, dirPath]) => [
                    name,
                    dirPath
                        .replace(ancesdir(), ".")
                        .replace(new RegExp(escapeRegExp(path.sep), "g"), "/"),
                ])
                // Finally, this has to be an actual glob, or it won't work.
                .map(([name, dirPath]) => [name, `${dirPath}/**`])
                .sort()
        );
    };
    const exampleGlobs = getExampleGlobs();

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
