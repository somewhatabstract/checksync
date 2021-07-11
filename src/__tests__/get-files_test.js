// @flow
import * as FastGlob from "fast-glob";
import Logger from "../logger.js";
import StringLogger from "../string-logger.js";
import * as IgnoreFilesToExcludeGlobs from "../ignore-files-to-exclude-globs.js";

import getFiles from "../get-files.js";
import {jest} from "@jest/globals";

jest.mock("fast-glob");
jest.mock("fs");

describe("#getFiles", () => {
    it("should return a sorted list without duplicates", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        const result = await getFiles(
            ["pattern1", "pattern2"],
            [],
            [],
            NullLogger,
        );

        // Assert
        expect(result).toEqual(["a", "b", "c", "d"]);
        expect(globSpy).toHaveBeenCalledTimes(1);
    });

    it("should exclude files matched by exclude globs and ignore files", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );
        jest.spyOn(IgnoreFilesToExcludeGlobs, "default").mockReturnValue([
            "**/ignore-file/**",
        ]);

        // Act
        await getFiles([], ["a", "c"], ["ignore-file"], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            [],
            expect.objectContaining({ignore: ["a", "c", "**/ignore-file/**"]}),
        );
    });

    it("should log verbosely", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(FastGlob, "default").mockImplementation((pattern, opts) =>
            Promise.resolve(["c", "a", "d", "b"]),
        );
        const verboseSpy = jest.spyOn(NullLogger, "verbose");

        // Act
        await getFiles([], ["a", "c"], [], NullLogger);

        // Assert
        expect(verboseSpy).toHaveBeenCalledTimes(3);
    });

    it("should log matching snapshot", async () => {
        // Arrange
        const logger = new StringLogger(true);
        jest.spyOn(FastGlob, "default").mockImplementation((pattern, opts) =>
            Promise.resolve(["c", "a", "d", "b"]),
        );

        // Act
        await getFiles(["b", "d"], ["a", "c"], [], logger);
        const log = logger.getLog();

        // Assert
        expect(log).toMatchInlineSnapshot(`
            " VERBOSE  Include globs: [
                \\"b\\",
                \\"d\\"
            ]
             VERBOSE  Exclude globs: [
                \\"a\\",
                \\"c\\"
            ]
             VERBOSE  Discovered paths: [
                \\"a\\",
                \\"b\\",
                \\"c\\",
                \\"d\\"
            ]"
        `);
    });
});
