import * as GetFiles from "../get-files";
import * as GetMarkersFromFiles from "../get-markers-from-files";
import * as ProcessCache from "../process-cache";
import Logger from "../logger";

import checkSync from "../check-sync";
import {ExitCode} from "../exit-codes";

import {Options} from "../types";

jest.mock("../get-files");
jest.mock("../get-markers-from-files");
jest.mock("../process-cache");
jest.mock("../cwd-relative-path");

describe("#checkSync", () => {
    it("should log message if dry run autofix", async () => {
        // Arrange
        const NullLogger = new Logger();
        const logSpy = jest.spyOn(NullLogger, "info");
        jest.spyOn(GetFiles, "default").mockResolvedValue([]);

        // Act
        await checkSync(
            {
                includeGlobs: ["glob1", "glob2"],
                excludeGlobs: [],
                ignoreFiles: [],
                dryRun: true,
                autoFix: true,
                comments: ["//"],
                json: false,
                allowEmptyTags: false,
            },
            NullLogger,
        );

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            "DRY-RUN: Files will not be modified",
        );
    });

    it("should expand the globs to files", async () => {
        // Arrange
        const NullLogger = new Logger();
        const getFilesSpy = jest
            .spyOn(GetFiles, "default")
            .mockResolvedValue([]);

        // Act
        await checkSync(
            {
                includeGlobs: ["glob1", "glob2"],
                excludeGlobs: [],
                ignoreFiles: [],
                dryRun: false,
                autoFix: true,
                comments: ["//"],
                json: false,
                allowEmptyTags: false,
            },
            NullLogger,
        );

        // Assert
        expect(getFilesSpy).toHaveBeenCalledWith(
            ["glob1", "glob2"],
            [],
            [],
            NullLogger,
        );
    });

    it("should log error when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockResolvedValue([]);
        const errorSpy = jest.spyOn(NullLogger, "error");
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            ignoreFiles: [],
            dryRun: false,
            autoFix: false,
            comments: ["//"],
            json: false,
            allowEmptyTags: false,
        };

        // Act
        await checkSync(options, NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith("No matching files");
    });

    it("should return NO_FILES when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockResolvedValue([]);
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            ignoreFiles: [],
            dryRun: false,
            autoFix: false,
            comments: ["//"],
            json: false,
            allowEmptyTags: false,
        };

        // Act
        const result = await checkSync(options, NullLogger);

        // Assert
        expect(result).toBe(ExitCode.NO_FILES);
    });

    it("should build a marker cache from the files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockResolvedValue(["filea", "fileb"]);
        jest.spyOn(ProcessCache, "default").mockResolvedValue(ExitCode.SUCCESS);
        const getMarkersFromFilesSpy = jest
            .spyOn(GetMarkersFromFiles, "default")
            .mockResolvedValue({});
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            ignoreFiles: [],
            dryRun: false,
            autoFix: true,
            comments: ["//"],
            json: false,
            allowEmptyTags: false,
        };

        // Act
        await checkSync(options, NullLogger);

        // Assert
        expect(getMarkersFromFilesSpy).toHaveBeenCalledWith(options, [
            "filea",
            "fileb",
        ]);
    });

    it("should invoke ProcessCache with options, cache, and log", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache: Record<string, any> = {};
        jest.spyOn(GetFiles, "default").mockResolvedValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockResolvedValue(fakeCache);
        const ProcessCacheSpy = jest
            .spyOn(ProcessCache, "default")
            .mockResolvedValue(ExitCode.SUCCESS);
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            ignoreFiles: [],
            dryRun: false,
            autoFix: false,
            comments: ["//"],
            rootMarker: "marker",
            json: false,
            allowEmptyTags: false,
        };

        // Act
        await checkSync(options, NullLogger);

        // Assert
        expect(ProcessCacheSpy).toHaveBeenCalledWith(
            options,
            fakeCache,
            NullLogger,
        );
    });

    it("should return processCache result if no parsing errors", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache: Record<string, any> = {};
        jest.spyOn(GetFiles, "default").mockResolvedValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockResolvedValue(fakeCache);
        jest.spyOn(ProcessCache, "default").mockResolvedValue(ExitCode.SUCCESS);

        // Act
        const result = await checkSync(
            {
                includeGlobs: [],
                excludeGlobs: [],
                ignoreFiles: [],
                autoFix: false,
                comments: ["//"],
                dryRun: false,
                json: false,
                allowEmptyTags: false,
            },
            NullLogger,
        );

        // Assert
        expect(result).toBe(ExitCode.SUCCESS);
    });
});
