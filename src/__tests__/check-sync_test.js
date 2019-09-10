// @flow
import * as GetFiles from "../get-files.js";
import * as GetMarkersFromFiles from "../get-markers-from-files.js";
import * as HandleViolations from "../handle-violations.js";
import * as CwdRelativePath from "../cwd-relative-path.js";
import Logger from "../logger.js";

import checkSync from "../check-sync.js";
import ErrorCodes from "../error-codes.js";

jest.mock("../get-files.js");
jest.mock("../get-markers-from-files.js");
jest.mock("../handle-violations.js");
jest.mock("../cwd-relative-path.js");

describe("#checkSync", () => {
    it("should expand the globs to files", async () => {
        // Arrange
        const NullLogger = new Logger();
        const getFilesSpy = jest.spyOn(GetFiles, "default").mockReturnValue([]);

        // Act
        await checkSync(["glob1", "glob2"], true, ["//"], NullLogger);

        // Assert
        expect(getFilesSpy).toHaveBeenCalledWith(["glob1", "glob2"]);
    });

    it("should log error when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue([]);
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        await checkSync(["glob1", "glob2"], false, ["//"], NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith("No matching files");
    });

    it("should return NO_FILES when there are no matching files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue([]);

        // Act
        const result = await checkSync(
            ["glob1", "glob2"],
            false,
            ["//"],
            NullLogger,
        );

        // Assert
        expect(result).toBe(ErrorCodes.NO_FILES);
    });

    it("should build a marker cache from the files", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(HandleViolations, "default").mockReturnValue([]);
        const getMarkersFromFilesSpy = jest
            .spyOn(GetMarkersFromFiles, "default")
            .mockReturnValue({});

        // Act
        await checkSync([], true, ["//"], NullLogger);

        // Assert
        expect(getMarkersFromFilesSpy).toHaveBeenCalledWith(
            ["filea", "fileb"],
            ["//"],
            NullLogger,
        );
    });

    it("should log error if there were errors during cache build with autoFix", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        const errorSpy = jest.spyOn(NullLogger, "error");
        jest.spyOn(GetMarkersFromFiles, "default").mockImplementation(() => {
            NullLogger.error("Oh no!");
            return {};
        });

        // Act
        await checkSync([], true, ["//"], NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "Aborting fix due to parse errors. Fix errors and try again.",
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

        // Act
        const result = await checkSync([], true, ["//"], NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.PARSE_ERRORS);
    });

    it("should invoke handleViolations with cache, autoFix, and log", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        const handleViolationsSpy = jest
            .spyOn(HandleViolations, "default")
            .mockReturnValue([]);

        // Act
        await checkSync([], false, ["//"], NullLogger);

        // Assert
        expect(handleViolationsSpy).toHaveBeenCalledWith(
            fakeCache,
            false,
            NullLogger,
        );
    });

    it("should return SUCCESS if no violations", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        jest.spyOn(HandleViolations, "default").mockReturnValue([]);

        // Act
        const result = await checkSync([], false, ["//"], NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.SUCCESS);
    });

    it("should return SUCCESS if violations with autoFix", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        jest.spyOn(HandleViolations, "default").mockReturnValue(["violation"]);

        // Act
        const result = await checkSync([], true, ["//"], NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.SUCCESS);
    });

    it("should output summary if violations with autoFix", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        jest.spyOn(HandleViolations, "default").mockReturnValue(["violation"]);
        const infoSpy = jest.spyOn(NullLogger, "info");

        // Act
        await checkSync([], true, ["//"], NullLogger);

        // Assert
        expect(infoSpy).toHaveBeenCalledWith("Fixed 1 file(s)");
    });

    it("should return DESYNCHRONIZED_BLOCKS if violations without autoFix", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        jest.spyOn(HandleViolations, "default").mockReturnValue(["violation"]);

        // Act
        const result = await checkSync([], false, ["//"], NullLogger);

        // Assert
        expect(result).toBe(ErrorCodes.DESYNCHRONIZED_BLOCKS);
    });

    it("should example of how to fix violations if not autoFix", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeCache = {};
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        jest.spyOn(GetMarkersFromFiles, "default").mockReturnValue(fakeCache);
        jest.spyOn(HandleViolations, "default").mockReturnValue([
            "violation1",
            "violation2",
        ]);
        jest.spyOn(CwdRelativePath, "default").mockImplementation(f => f);
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        await checkSync([], false, ["//"], NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "checksync --fix violation1 violation2",
            true,
        );
    });
});
