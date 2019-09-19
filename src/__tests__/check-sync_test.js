// @flow
import * as GetFiles from "../get-files.js";
import * as GetMarkersFromFiles from "../get-markers-from-files.js";
import * as ProcessCache from "../process-cache.js";
import Logger from "../logger.js";

import checkSync from "../check-sync.js";
import ErrorCodes from "../error-codes.js";

import type {Options} from "../types.js";

jest.mock("../get-files.js");
jest.mock("../get-markers-from-files.js");
jest.mock("../process-cache.js");
jest.mock("../cwd-relative-path.js");

describe("#checkSync", () => {
    it("should expand the globs to files", async () => {
        // Arrange
        const NullLogger = new Logger();
        const getFilesSpy = jest.spyOn(GetFiles, "default").mockReturnValue([]);

        // Act
        await checkSync(
            {
                includeGlobs: ["glob1", "glob2"],
                excludeGlobs: [],
                dryRun: false,
                autoFix: true,
                comments: ["//"],
            },
            NullLogger,
        );

        // Assert
        expect(getFilesSpy).toHaveBeenCalledWith(["glob1", "glob2"], []);
    });

    it("should log error when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue([]);
        const errorSpy = jest.spyOn(NullLogger, "error");
        const options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            dryRun: false,
            autoFix: false,
            comments: ["//"],
        };

        // Act
        await checkSync(options, NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith("No matching files");
    });

    it("should return NO_FILES when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue([]);
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            dryRun: false,
            autoFix: false,
            comments: ["//"],
        };

        // Act
        const result = await checkSync(options, NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.NO_FILES);
    });

    it("should build a marker cache from the files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(ProcessCache, "default").mockReturnValue([]);
        const getMarkersFromFilesSpy = jest
            .spyOn(GetMarkersFromFiles, "default")
            .mockReturnValue({});
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            dryRun: false,
            autoFix: true,
            comments: ["//"],
        };

        // Act
        await checkSync(options, NullLogger);

        // Assert
        expect(getMarkersFromFilesSpy).toHaveBeenCalledWith(
            options,
            ["filea", "fileb"],
            NullLogger,
        );
    });

    it("should log error if there were errors during cache build with autoFix", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        const logSpy = jest.spyOn(NullLogger, "log");
        jest.spyOn(GetMarkersFromFiles, "default").mockImplementation(() => {
            NullLogger.error("Oh no!");
            return {};
        });
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            dryRun: false,
            autoFix: true,
            comments: ["//"],
        };

        // Act
        await checkSync(options, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            "🛑  Aborting tag updates due to parsing errors. Fix these errors and try again.",
        );
    });

    it("should return PARSE_ERRORS when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockImplementation(() => {
            NullLogger.error("Oh no!");
            return {};
        });
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            dryRun: false,
            autoFix: true,
            comments: ["//"],
        };

        // Act
        const result = await checkSync(options, NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.PARSE_ERRORS);
    });

    it("should invoke ProcessCache with options, cache, and log", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        const ProcessCacheSpy = jest
            .spyOn(ProcessCache, "default")
            .mockReturnValue([]);
        const options: Options = {
            includeGlobs: ["glob1", "glob2"],
            excludeGlobs: [],
            dryRun: false,
            autoFix: false,
            comments: ["//"],
            rootMarker: "marker",
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
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        jest.spyOn(ProcessCache, "default").mockReturnValue(ErrorCodes.SUCCESS);

        // Act
        const result = await checkSync(
            {
                includeGlobs: [],
                excludeGlobs: [],
                autoFix: false,
                comments: ["//"],
                dryRun: false,
            },
            NullLogger,
        );

        // Assert
        expect(result).toBe(ErrorCodes.SUCCESS);
    });
});
