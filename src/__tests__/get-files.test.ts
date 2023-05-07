import fs from "fs";
import * as FastGlob from "fast-glob";
import Logger from "../logger";
import StringLogger from "../string-logger";
import * as IgnoreFileGlobsToExcludeGlobs from "../ignore-file-globs-to-exclude-globs";

import getFiles from "../get-files";
import {jest} from "@jest/globals";

jest.mock("fast-glob");

describe("#getFiles", () => {
    it("should expand directories to globs", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockImplementation(
            () =>
                ({
                    isDirectory: () => true,
                } as any),
        );
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((p) => Promise.resolve([...p]));

        // Act
        await getFiles(["pattern1", "pattern2"], [], [], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["pattern1/**", "pattern2/**"],
            expect.any(Object),
        );
    });

    it("should not check if globs are directories", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        const lstatSyncSpy = jest.spyOn(fs, "lstatSync");
        jest.spyOn(FastGlob, "default").mockImplementation((p) =>
            Promise.resolve([...p]),
        );

        // Act
        await getFiles(["pattern1/*", "pattern2/*"], [], [], NullLogger);

        // Assert
        expect(lstatSyncSpy).not.toHaveBeenCalled();
    });

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
        jest.spyOn(IgnoreFileGlobsToExcludeGlobs, "default").mockResolvedValue([
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
            "  Verbose  Include globs: [
                "b",
                "d"
            ]
              Verbose  Exclude globs: [
                "a",
                "c"
            ]
              Verbose  Discovered paths: [
                "a",
                "b",
                "c",
                "d"
            ]"
        `);
    });
});
