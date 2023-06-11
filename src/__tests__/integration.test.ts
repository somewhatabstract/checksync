import fs from "fs";
import path from "path";
import ancesdir from "ancesdir";
import StringLogger from "../string-logger";

import checkSync from "../check-sync";
import determineOptions from "../determine-options";

jest.mock("../get-launch-string", () => () => "checksync");
jest.mock("../../package.json", () => ({
    // We don't use the real version so that snapshots are consistent.
    version: "0.0.0",
}));

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
        // We only want directories.
        .filter((name) => fs.lstatSync(name).isDirectory())
        // Finally, this has to be an actual glob, or it won't work,
        // and we need our ignore files.
        .map((name) => [name, `**/${name}/**`])
        .sort();

    it.each(exampleGlobs)(
        "should report example %s to match snapshot",
        async (name, glob) => {
            // Arrange
            const stringLogger = new StringLogger(true);
            // This takes an args object, looks for and loads the config file,
            // and then combines them with defaults to get the options to run.
            const options = await determineOptions(
                {
                    _: [glob],
                },
                stringLogger,
            );

            // Act
            await checkSync(options, stringLogger);
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );

    it.each(exampleGlobs)(
        "should report example %s to match snapshot with autofix dryrun",
        async (name, glob) => {
            // Arrange
            const stringLogger = new StringLogger(true);
            // This takes an args object, looks for and loads the config file,
            // and then combines them with defaults to get the options to run.
            const options = await determineOptions(
                {
                    _: [glob],
                    updateTags: true,
                    dryRun: true,
                },
                stringLogger,
            );

            // Act
            await checkSync(options, stringLogger);
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );

    it.each(exampleGlobs)(
        "should report example %s to match snapshot with json",
        async (name, glob) => {
            // Arrange
            const stringLogger = new StringLogger(true);
            // This takes an args object, looks for and loads the config file,
            // and then combines them with defaults to get the options to run.
            const options = await determineOptions(
                {
                    _: [glob],
                    json: true,
                },
                stringLogger,
            );

            // Act
            await checkSync(options, stringLogger);
            const result = stringLogger.getLog();

            // Assert
            expect(result).toMatchSnapshot();
        },
    );
});
