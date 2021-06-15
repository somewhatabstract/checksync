// @flow
import fs from "fs";
import readline from "readline";

import ErrorCodes from "../error-codes.js";
import Logger from "../logger.js";
import FileReferenceLogger from "../file-reference-logger.js";
import fixFile from "../fix-file.js";

import * as RootRelativePath from "../root-relative-path.js";

import type {Options} from "../types.js";

const invokeEvent = (mocked: $Call<typeof jest.fn>, event: string, ...args) => {
    const eventHandlerCall = mocked.mock.calls.find(
        (call) => call[0] === event,
    );
    if (eventHandlerCall == null) {
        throw new Error(
            "Event handler not found on our fake readline interface",
        );
    }
    eventHandlerCall[1](...args);
};

const _NullLogger = new Logger(null);

describe("#fixFile", () => {
    const options: Options = {
        includeGlobs: [],
        excludeGlobs: [],
        dryRun: false,
        autoFix: true,
        comments: [],
        rootMarker: null,
        json: false,
    };

    it("should resolve if there are no mismatches for file", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);

        // Act
        const underTest = fixFile(options, "filea", NullFileLogger, {});

        // Assert
        await expect(underTest).resolves;
    });

    it("should log checksum mismatches", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream = {
            once: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
        };
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation(() => {
            invokeEvent(fakeWriteStream.once, "close");
        });
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce({});
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const logSpy = jest.spyOn(NullFileLogger, "fix");
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    code: ErrorCodes.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 42,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        await promise;

        // Assert
        expect(logSpy).toHaveBeenCalledWith("FIXES THE MISMATCH", 42);
    });

    it("should write out lines as they are if no fix required, with newline appended", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream = {
            once: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
        };
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation(() => {
            invokeEvent(fakeWriteStream.once, "close");
        });
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce({});
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const logSpy = jest.spyOn(NullFileLogger, "fix");
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    code: ErrorCodes.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 42,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        readLineFromFile("REGULAR_LINE");
        finishReadingFile();
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenCalledWith("REGULAR_LINE\n");
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("should write replacement fix lines with newline appended for mismatches", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream = {
            once: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
        };
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation(() => {
            invokeEvent(fakeWriteStream.once, "close");
        });
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce({});
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    code: ErrorCodes.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 42,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenCalledWith("MISMATCH FIX\n");
        expect(fakeWriteStream.write).not.toHaveBeenCalledWith(
            "BROKEN_DECLARATION\n",
        );
    });

    it("should not write anything for delete fixes", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream = {
            once: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
        };
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation(() => {
            invokeEvent(fakeWriteStream.once, "close");
        });
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce({});
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    code: ErrorCodes.duplicateTarget,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "delete",
                        declaration: "BROKEN_DECLARATION",
                        line: 42,
                        description: "DELETES THE LINE",
                    },
                },
            ],
        });
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        await promise;

        // Assert
        expect(fakeWriteStream.write).not.toHaveBeenCalled();
    });

    it("should not write to file during dry run", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream = {
            once: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
        };
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation(() => {
            invokeEvent(fakeWriteStream.once, "close");
        });
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce({});
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const testOptions: Options = {
            ...options,
            dryRun: true,
        };

        // Act
        const promise = fixFile(testOptions, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    code: ErrorCodes.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 42,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();

        await promise;

        // Assert
        expect(fakeWriteStream.write).not.toHaveBeenCalled();
    });
});
