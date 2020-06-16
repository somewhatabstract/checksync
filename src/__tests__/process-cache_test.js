// @flow
import processCache from "../process-cache.js";
import Logger from "../logger.js";
import ErrorCodes from "../error-codes.js";

import * as ValidateAndReport from "../validate-and-report.js";
import * as ValidateAndFix from "../validate-and-fix.js";

import type {MarkerCache, Marker, Target, Options} from "../types.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("#processCache", () => {
    const TestCache: MarkerCache = {
        filea: {
            aliases: ["filea"],
            markers: {
                marker1: ({
                    commentStart: "//",
                    commentEnd: undefined,
                    fixable: true,
                    checksum: "5678",
                    targets: {
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "fileb",
                            declaration:
                                "// sync-start:marker1 MISMATCH! fileb",
                        }: Target),
                    },
                }: Marker),
                marker2: ({
                    commentStart: "//",
                    commentEnd: undefined,
                    fixable: true,
                    checksum: "5678",
                    targets: {
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "fileb",
                            declaration:
                                "// sync-start:marker2 MISMATCH! fileb",
                        }: Target),
                    },
                }: Marker),
            },
        },
        fileb: {
            aliases: ["fileb"],
            markers: {
                marker1: ({
                    commentStart: "//",
                    commentEnd: undefined,
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                            declaration: "// sync-start:marker1 5678 filea",
                        }: Target),
                    },
                }: Marker),
                marker2: ({
                    commentStart: "//",
                    commentEnd: undefined,
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                            declaration: "// sync-start:marker2 5678 filea",
                        }: Target),
                    },
                }: Marker),
            },
        },
    };

    describe("autofix is false", () => {
        it("should call validateAndReport for each file when not autofixing", async () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest
                .spyOn(ValidateAndReport, "default")
                .mockReturnValue(Promise.resolve(true));
            const options: Options = {
                includeGlobs: [],
                comments: [],
                autoFix: false,
                rootMarker: null,
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(spy).toHaveBeenCalledWith(
                options,
                "filea",
                TestCache,
                NullLogger,
            );
            expect(spy).toHaveBeenCalledWith(
                options,
                "fileb",
                TestCache,
                NullLogger,
            );
        });

        it("should return ErrorCodes.SUCCESS if all files are valid", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(true),
            );
            const options: Options = {
                includeGlobs: [],
                comments: [],
                autoFix: false,
                rootMarker: null,
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            const result = await processCache(options, TestCache, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should return ErrorCodes.DESYNCHRONIZED_BLOCKS if some files are invalid", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: [],
                comments: [],
                autoFix: false,
                rootMarker: "marker",
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            const result = await processCache(options, TestCache, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.DESYNCHRONIZED_BLOCKS);
        });

        it("should output guidance if syntax is valid but blocks mismatch", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            const groupSpy = jest.spyOn(NullLogger, "group");
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: false,
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(groupSpy).toHaveBeenCalledWith(
                "🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:",
            );
            expect(logSpy).toHaveBeenCalledWith(
                `checksync -c "//" -u filea fileb`,
            );
        });

        it("should output guidance if syntax errors and blocks mismatch", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            const groupSpy = jest.spyOn(NullLogger, "group");
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: false,
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            NullLogger.error("This was an error during parsing!");
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(groupSpy).toHaveBeenCalledWith(
                "🛑  Desynchronized blocks detected and parsing errors found. Fix the errors, update the blocks, then update the sync-start tags using:",
            );
            expect(logSpy).toHaveBeenCalledWith(
                `checksync -c "//" -u filea fileb`,
            );
        });
    });

    describe("autofix is true", () => {
        it("should call validateAndFix for each file", async () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest
                .spyOn(ValidateAndFix, "default")
                .mockReturnValue(Promise.resolve(true));
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: null,
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(spy).toHaveBeenCalledWith(
                options,
                "filea",
                TestCache,
                NullLogger,
            );
            expect(spy).toHaveBeenCalledWith(
                options,
                "fileb",
                TestCache,
                NullLogger,
            );
        });

        it("should return ErrorCodes.SUCCESS if no files were fixed", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(true),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: null,
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            const result = await processCache(options, TestCache, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should return ErrorCodes.SUCCESS if files were fixed", async () => {
            // Arrange
            const NullLogger = new Logger();
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            const result = await processCache(options, TestCache, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should log how many files were fixed when not dry run", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "info");
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: false,
                excludeGlobs: [],
            };

            // Act
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(logSpy).toHaveBeenCalledWith("Fixed 2 file(s)");
        });

        it("should log how many files would be fixed when dry run", async () => {
            // Arrange
            const NullLogger = new Logger();
            const groupSpy = jest.spyOn(NullLogger, "group");
            const logSpy = jest.spyOn(NullLogger, "log");
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: true,
                excludeGlobs: [],
            };

            // Act
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(groupSpy).toHaveBeenCalledWith(
                "2 file(s) would have been fixed. To fix, run:",
            );
            expect(logSpy).toHaveBeenCalledWith(
                `checksync -c "//" -m "marker" -u filea fileb`,
            );
        });

        it("should exclude comment arg from fix suggestion if it matches default", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(false),
            );
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//", "#"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: true,
                excludeGlobs: [],
            };

            // Act
            await processCache(options, TestCache, NullLogger);

            // Assert
            expect(logSpy).toHaveBeenCalledWith(
                `checksync -m "marker" -u filea fileb`,
            );
        });
    });

    it("should log error if file validator errors", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(ValidateAndFix, "default").mockReturnValue(
            Promise.reject(new Error("Oh no!")),
        );
        const logSpy = jest.spyOn(NullLogger, "error");
        const options: Options = {
            includeGlobs: ["filea", "fileb"],
            comments: ["//"],
            autoFix: true,
            rootMarker: "marker",
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        await processCache(options, TestCache, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            "filea update encountered error: Oh no!",
        );
        expect(logSpy).toHaveBeenCalledWith(
            "fileb update encountered error: Oh no!",
        );
    });

    it("should log if errors occurred during processing ", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(ValidateAndFix, "default").mockReturnValue(
            Promise.reject(new Error("Oh no!")),
        );
        const logSpy = jest.spyOn(NullLogger, "log");
        const options: Options = {
            includeGlobs: ["filea", "fileb"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        const result = await processCache(options, TestCache, NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.PARSE_ERRORS);
        expect(logSpy).toHaveBeenCalledWith(
            "🛑  Errors occurred during processing",
        );
    });
});
