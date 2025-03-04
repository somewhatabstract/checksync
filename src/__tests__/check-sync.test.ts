import * as GetFiles from "../get-files";
import * as GetMarkersFromFiles from "../get-markers-from-files";
import * as ProcessCache from "../process-cache";
import * as LoadCache from "../load-cache";
import * as OutputCache from "../output-cache";
import Logger from "../logger";

import checkSync from "../check-sync";
import {ExitCode} from "../exit-codes";

import {Options} from "../types";
import {ExitError} from "../exit-error";

jest.mock("../get-files");
jest.mock("../get-markers-from-files");
jest.mock("../process-cache");
jest.mock("../load-cache");
jest.mock("../output-cache");
jest.mock("../cwd-relative-path");

describe("#checkSync", () => {
    describe("when cacheMode is ignore", () => {
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
                    cachePath: "",
                    cacheMode: "ignore",
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
                    cachePath: "",
                    cacheMode: "ignore",
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
                cachePath: "",
                cacheMode: "ignore",
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
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            const result = await checkSync(options, NullLogger);

            // Assert
            expect(result).toBe(ExitCode.NO_FILES);
        });

        it("should log error when some unexpected error occurs", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockRejectedValue(
                new Error("Unexpected error"),
            );
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
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                "Unexpected catastrophic error",
            );
        });

        it("should return CATASTROPHIC when an unexpected error occurs", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockRejectedValue(
                new Error("Unexpected error"),
            );
            const options: Options = {
                includeGlobs: ["glob1", "glob2"],
                excludeGlobs: [],
                ignoreFiles: [],
                dryRun: false,
                autoFix: false,
                comments: ["//"],
                json: false,
                allowEmptyTags: false,
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            const result = await checkSync(options, NullLogger);

            // Assert
            expect(result).toBe(ExitCode.CATASTROPHIC);
        });

        it("should build a marker cache from the files", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(ProcessCache, "default").mockResolvedValue(
                ExitCode.SUCCESS,
            );
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
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(getMarkersFromFilesSpy).toHaveBeenCalledWith(options, [
                "filea",
                "fileb",
            ]);
        });

        it("should invoke processCache with options, cache, and log", async () => {
            // Arrange
            const NullLogger = new Logger();
            const fakeCache: Record<string, any> = {};
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(GetMarkersFromFiles, "default").mockResolvedValue(
                fakeCache,
            );
            const processCacheSpy = jest
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
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(processCacheSpy).toHaveBeenCalledWith(
                options,
                fakeCache,
                NullLogger,
            );
        });

        it("should return processCache result if no parsing errors", async () => {
            // Arrange
            const NullLogger = new Logger();
            const fakeCache: Record<string, any> = {};
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(GetMarkersFromFiles, "default").mockResolvedValue(
                fakeCache,
            );
            jest.spyOn(ProcessCache, "default").mockResolvedValue(
                ExitCode.SUCCESS,
            );

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
                    cachePath: "",
                    cacheMode: "ignore",
                },
                NullLogger,
            );

            // Assert
            expect(result).toBe(ExitCode.SUCCESS);
        });
    });

    describe("when cache mode is read", () => {
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
                    cachePath: "",
                    cacheMode: "read",
                },
                NullLogger,
            );

            // Assert
            expect(logSpy).toHaveBeenCalledWith(
                "DRY-RUN: Files will not be modified",
            );
        });

        it("should log error when the cache can't be loaded", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockResolvedValue([]);
            jest.spyOn(LoadCache, "loadCache").mockRejectedValue(
                new ExitError("Can't load cache", ExitCode.BAD_CACHE),
            );
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
                cachePath: "",
                cacheMode: "read",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(errorSpy).toHaveBeenCalledWith("Unable to load cache");
        });

        it("should return NO_FILES when there are no matching files", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(LoadCache, "loadCache").mockRejectedValue(
                new ExitError("Can't load cache", ExitCode.BAD_CACHE),
            );
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
                cachePath: "",
                cacheMode: "read",
            };

            // Act
            const result = await checkSync(options, NullLogger);

            // Assert
            expect(result).toBe(ExitCode.BAD_CACHE);
        });

        it("should log error when some unexpected error occurs", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(LoadCache, "loadCache").mockRejectedValue(
                new Error("UNEXPECTED ERROR"),
            );
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
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                "Unexpected catastrophic error",
            );
        });

        it("should return CATASTROPHIC when an unexpected error occurs", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(LoadCache, "loadCache").mockRejectedValue(
                new Error("UNEXPECTED ERROR"),
            );
            const options: Options = {
                includeGlobs: ["glob1", "glob2"],
                excludeGlobs: [],
                ignoreFiles: [],
                dryRun: false,
                autoFix: false,
                comments: ["//"],
                json: false,
                allowEmptyTags: false,
                cachePath: "",
                cacheMode: "ignore",
            };

            // Act
            const result = await checkSync(options, NullLogger);

            // Assert
            expect(result).toBe(ExitCode.CATASTROPHIC);
        });

        it("should load the marker cache", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(ProcessCache, "default").mockResolvedValue(
                ExitCode.SUCCESS,
            );
            const loadCacheSpy = jest
                .spyOn(LoadCache, "loadCache")
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
                cachePath: "CACHE_FILE_PATH",
                cacheMode: "read",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(loadCacheSpy).toHaveBeenCalledWith(
                "CACHE_FILE_PATH",
                NullLogger,
            );
        });

        it("should invoke processCache with options, cache, and log", async () => {
            // Arrange
            const NullLogger = new Logger();
            const fakeCache: Record<string, any> = {};
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(LoadCache, "loadCache").mockResolvedValue(fakeCache);
            const processCacheSpy = jest
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
                cachePath: "",
                cacheMode: "read",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(processCacheSpy).toHaveBeenCalledWith(
                options,
                fakeCache,
                NullLogger,
            );
        });

        it("should return processCache result if no parsing errors", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(LoadCache, "loadCache").mockResolvedValue({});
            jest.spyOn(ProcessCache, "default").mockResolvedValue(
                ExitCode.SUCCESS,
            );

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
                    cachePath: "",
                    cacheMode: "read",
                },
                NullLogger,
            );

            // Assert
            expect(result).toBe(ExitCode.SUCCESS);
        });
    });

    describe("when cache mode is write", () => {
        it("should not log message if dry run autofix (these aren't meaningful in cache write mode)", async () => {
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
                    cachePath: "",
                    cacheMode: "write",
                },
                NullLogger,
            );

            // Assert
            expect(logSpy).not.toHaveBeenCalled();
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
                    cachePath: "",
                    cacheMode: "write",
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
                cachePath: "",
                cacheMode: "write",
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
                cachePath: "",
                cacheMode: "write",
            };

            // Act
            const result = await checkSync(options, NullLogger);

            // Assert
            expect(result).toBe(ExitCode.NO_FILES);
        });

        it("should log error when some unexpected error occurs", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockRejectedValue(
                new Error("Unexpected error"),
            );
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
                cachePath: "",
                cacheMode: "write",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                "Unexpected catastrophic error",
            );
        });

        it("should return CATASTROPHIC when an unexpected error occurs", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockRejectedValue(
                new Error("Unexpected error"),
            );
            const options: Options = {
                includeGlobs: ["glob1", "glob2"],
                excludeGlobs: [],
                ignoreFiles: [],
                dryRun: false,
                autoFix: false,
                comments: ["//"],
                json: false,
                allowEmptyTags: false,
                cachePath: "",
                cacheMode: "write",
            };

            // Act
            const result = await checkSync(options, NullLogger);

            // Assert
            expect(result).toBe(ExitCode.CATASTROPHIC);
        });

        it("should build a marker cache from the files", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(ProcessCache, "default").mockResolvedValue(
                ExitCode.SUCCESS,
            );
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
                cachePath: "",
                cacheMode: "write",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(getMarkersFromFilesSpy).toHaveBeenCalledWith(options, [
                "filea",
                "fileb",
            ]);
        });

        it("should invoke outputCache with options, cache, and log", async () => {
            // Arrange
            const NullLogger = new Logger();
            const fakeCache: Record<string, any> = {};
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(GetMarkersFromFiles, "default").mockResolvedValue(
                fakeCache,
            );
            const outputCacheSpy = jest
                .spyOn(OutputCache, "outputCache")
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
                cachePath: "",
                cacheMode: "write",
            };

            // Act
            await checkSync(options, NullLogger);

            // Assert
            expect(outputCacheSpy).toHaveBeenCalledWith(
                options,
                fakeCache,
                NullLogger,
            );
        });

        it("should return outputCache result if no parsing errors", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(GetFiles, "default").mockResolvedValue([
                "filea",
                "fileb",
            ]);
            jest.spyOn(GetMarkersFromFiles, "default").mockResolvedValue({});
            jest.spyOn(OutputCache, "outputCache").mockResolvedValue(
                ExitCode.SUCCESS,
            );

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
                    cachePath: "",
                    cacheMode: "write",
                },
                NullLogger,
            );

            // Assert
            expect(result).toBe(ExitCode.SUCCESS);
        });
    });
});
