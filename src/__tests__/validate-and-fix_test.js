// @flow
import fs from "fs";
import readline from "readline";

import Logger from "../logger.js";
import validateAndFix from "../validate-and-fix.js";

import * as GenerateMarkerEdges from "../generate-marker-edges.js";
import * as RootRelativePath from "../root-relative-path.js";

import type {Options, MarkerEdge} from "../types.js";

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

describe("#validateAndFix", () => {
    const options: Options = {
        includeGlobs: [],
        excludeGlobs: [],
        dryRun: false,
        autoFix: true,
        comments: [],
        rootMarker: null,
        json: false,
    };

    it("should resolve true if there are no broken edges in file", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([]);

        // Act
        const result = await validateAndFix(options, "filea", {}, NullLogger);

        // Assert
        expect(result).toBeTrue();
    });

    it("should resolve false if the target of a tag does not exist", async () => {
        // Arrange
        const NullLogger = new Logger(null);
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
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: "",
                sourceChecksum: "SRC_CHECKSUM",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: undefined,
                targetLine: undefined,
            },
        ]);
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = validateAndFix(options, "filea", {}, NullLogger);
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toBeFalse();
    });

    it("should log error if the target of the tag does not exist", async () => {
        // Arrange
        const NullLogger = new Logger(null);
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
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: "",
                sourceChecksum: "SRC_CHECKSUM",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: undefined,
                targetLine: undefined,
            },
        ]);
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const logSpy = jest.spyOn(NullLogger, "error");

        // Act
        const promise = validateAndFix(options, "filea", {}, NullLogger);
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        await promise;

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            "fileb does not contain a tag named 'MARKER_ID' that points to 'filea'",
        );
    });

    it("should return false if file contains broken edges", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const fakeWriteStream = {once: jest.fn(), end: jest.fn()};
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
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            ({
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: "",
                sourceChecksum: "SRC_CHECKSUM",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: "TARGET_CHECKSUM",
                targetLine: "99",
            }: MarkerEdge),
        ]);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = validateAndFix(options, "filea", {}, NullLogger);
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toBeFalse();
    });

    it("should report broken edges to the log", async () => {
        // Arrange
        const NullLogger = new Logger(null);
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
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            ({
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: "",
                sourceChecksum: "SRC_CHECKSUM",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: "TARGET_CHECKSUM",
                targetLine: "99",
            }: MarkerEdge),
        ]);
        const logSpy = jest.spyOn(NullLogger, "log");
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = validateAndFix(options, "filea", {}, NullLogger);
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        await promise;

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            " MISMATCH  filea:42 Updating checksum for sync-tag 'MARKER_ID' referencing 'fileb:99' from SRC_CHECKSUM to TARGET_CHECKSUM.",
        );
    });

    it("should copy unbroken lines from read to write with newline appended", async () => {
        // Arrange
        const NullLogger = new Logger(null);
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
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            ({
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: undefined,
                sourceChecksum: "SRC_CHECKSUM",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: "TARGET_CHECKSUM",
                targetLine: "99",
            }: MarkerEdge),
        ]);
        const logSpy = jest.spyOn(NullLogger, "log");
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = validateAndFix(options, "filea", {}, NullLogger);
        readLineFromFile("REGULAR_LINE");
        finishReadingFile();
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenCalledWith("REGULAR_LINE\n");
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("should write fixed lines with newline appended for broken edges", async () => {
        // Arrange
        const NullLogger = new Logger(null);
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
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            ({
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: " COMMENT_END",
                sourceChecksum: "",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: "TARGET_CHECKSUM",
                targetLine: "99",
            }: MarkerEdge),
        ]);
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = validateAndFix(options, "filea", {}, NullLogger);
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenCalledWith(
            "// sync-start:MARKER_ID TARGET_CHECKSUM ROOT_REL:fileb COMMENT_END\n",
        );
        expect(fakeWriteStream.write).not.toHaveBeenCalledWith(
            "BROKEN_DECLARATION\n",
        );
    });

    it("should not write to file during dry run", async () => {
        // Arrange
        const NullLogger = new Logger(null);
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
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            ({
                markerID: "MARKER_ID",
                sourceCommentStart: "//",
                sourceCommentEnd: "COMMENT_END",
                sourceChecksum: "",
                sourceDeclaration: "BROKEN_DECLARATION",
                sourceLine: "42",
                targetFile: "fileb",
                targetChecksum: "TARGET_CHECKSUM",
                targetLine: "99",
            }: MarkerEdge),
        ]);
        const readLineFromFile = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const testOptions: Options = {
            ...options,
            dryRun: true,
        };

        // Act
        const promise = validateAndFix(testOptions, "filea", {}, NullLogger);
        readLineFromFile("BROKEN_DECLARATION");
        finishReadingFile();

        await promise;

        // Assert
        expect(fakeWriteStream.write).not.toHaveBeenCalled();
    });
});
