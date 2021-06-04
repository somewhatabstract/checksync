// @flow
import Logger from "../logger.js";
import ErrorCodes from "../error-codes.js";
import outputText from "../output-text.js";

import type {Options} from "../types.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("#outputText", () => {
    describe("autofix is false", () => {
        it("should return ErrorCodes.SUCCESS if all files are valid", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options: Options = {
                includeGlobs: [],
                comments: [],
                autoFix: false,
                rootMarker: null,
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            const result = outputText(options, [], NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should return ErrorCodes.DESYNCHRONIZED_BLOCKS if some files are invalid", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options: Options = {
                includeGlobs: [],
                comments: [],
                autoFix: false,
                rootMarker: "marker",
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            const result = outputText(options, ["filea", "fileb"], NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.DESYNCHRONIZED_BLOCKS);
        });

        it("should output guidance if syntax is valid but blocks mismatch", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            const groupSpy = jest.spyOn(NullLogger, "group");
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: false,
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            outputText(options, ["filea", "fileb"], NullLogger);

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
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: false,
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            NullLogger.error("This was an error during parsing!");
            outputText(options, ["filea", "fileb"], NullLogger);

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
        it("should return ErrorCodes.SUCCESS if no files were fixed", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: null,
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            const result = outputText(options, [], NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should return ErrorCodes.SUCCESS if files were fixed", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            const result = outputText(options, ["filea", "fileb"], NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should log how many files were fixed when not dry run", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "info");
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: false,
                excludeGlobs: [],
                json: false,
            };

            // Act
            outputText(options, ["filea", "fileb"], NullLogger);

            // Assert
            expect(logSpy).toHaveBeenCalledWith("Fixed 2 file(s)");
        });

        it("should log how many files would be fixed when dry run", async () => {
            // Arrange
            const NullLogger = new Logger();
            const groupSpy = jest.spyOn(NullLogger, "group");
            const logSpy = jest.spyOn(NullLogger, "log");
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: true,
                excludeGlobs: [],
                json: false,
            };

            // Act
            outputText(options, ["filea", "fileb"], NullLogger);

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
            const options: Options = {
                includeGlobs: ["filea", "fileb"],
                comments: ["//", "#"],
                autoFix: true,
                rootMarker: "marker",
                dryRun: true,
                excludeGlobs: [],
                json: false,
            };

            // Act
            outputText(options, ["filea", "fileb"], NullLogger);

            // Assert
            expect(logSpy).toHaveBeenCalledWith(
                `checksync -m "marker" -u filea fileb`,
            );
        });
    });
});
