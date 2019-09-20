// @flow
import fs from "fs";
import readline from "readline";

import * as MarkerParser from "../marker-parser.js";
import * as FileReferenceLogger from "../file-reference-logger.js";

import Logger from "../logger.js";
import parseFile from "../parse-file.js";

const invokeEvent = (mocked: $Call<typeof jest.fn>, event: string, ...args) => {
    const eventHandlerCall = mocked.mock.calls.find(call => call[0] === event);
    if (eventHandlerCall == null) {
        throw new Error(
            "Event handler not found on our fake readline interface",
        );
    }
    eventHandlerCall[1](...args);
};

describe("#parseFile", () => {
    const setupMarkerParser = function() {
        const mockParser = {
            reportUnterminatedMarkers: jest.fn(),
            parseLine: jest.fn(),
        };
        jest.spyOn(MarkerParser, "default").mockImplementationOnce(
            () => mockParser,
        );
        return mockParser;
    };

    const setupFileReferenceLogger = function() {
        const mockFileReferenceLogger = {
            error: jest.fn(),
        };
        jest.spyOn(FileReferenceLogger, "default").mockImplementationOnce(
            () => mockFileReferenceLogger,
        );
        return mockFileReferenceLogger;
    };

    it("should create scoped logger for file", async () => {
        // Arrange
        setupMarkerParser();
        setupFileReferenceLogger();
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const fileRefLoggerSpy = jest.spyOn(FileReferenceLogger, "default");

        // Act
        const promise = parseFile("file.js", true, [], NullLogger);
        finishReadingFile();
        await promise;

        // Assert
        expect(fileRefLoggerSpy).toHaveBeenCalledWith(
            expect.stringContaining("file.js"),
            NullLogger,
        );
    });

    it("should log parse error on failure", async () => {
        // Arrange
        const NullLogger = new Logger();
        const logger = setupFileReferenceLogger();
        jest.spyOn(fs, "createReadStream").mockImplementationOnce(() => {
            throw new Error("ERROR_STRING");
        });

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(logger.error).toHaveBeenCalledWith(
            "Could not parse file: ERROR_STRING",
        );
    });

    it("should resolve with null if zero markers are found", async () => {
        // Arrange
        const NullLogger = new Logger();
        setupMarkerParser();
        const logger = setupFileReferenceLogger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = parseFile("file.js", true, [], NullLogger);
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toBeNull();
        expect(logger.error).not.toHaveBeenCalled(); // <- Verifies we're testing success
    });

    it("should resolve with null on error", async () => {
        // Arrange
        const NullLogger = new Logger();
        const mockFileReferenceLogger = setupFileReferenceLogger();
        jest.spyOn(fs, "createReadStream").mockImplementationOnce(() => {
            throw new Error("ERROR_STRING");
        });

        // Act
        const result = await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(result).toBeNull();
        expect(mockFileReferenceLogger.error).toHaveBeenCalled(); // <- Verifies we're testing failure
    });

    it("should invoke MarkerParser.parseLine for each line", async () => {
        // Arrange
        const NullLogger = new Logger();
        const mockMarkerParser = setupMarkerParser();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const readLine = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);

        // Act
        const promise = parseFile("file.js", true, [], NullLogger);
        readLine("Line1");
        readLine("Line2");
        finishReadingFile();
        await promise;

        // Assert
        expect(mockMarkerParser.parseLine).toHaveBeenCalledTimes(2);
        expect(mockMarkerParser.parseLine).toHaveBeenCalledWith("Line1");
        expect(mockMarkerParser.parseLine).toHaveBeenCalledWith("Line2");
    });

    it("should initialize MarkerParser with callbacks, comments, and log", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const mockFileReferenceLogger = setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const commentsArray = ["COMMENT1", "COMMENT2"];
        const mockNormalize = jest.fn();

        // Act
        const promise = parseFile(
            "file.js",
            true,
            commentsArray,
            NullLogger,
            mockNormalize,
        );
        finishReadingFile();
        await promise;

        // Assert
        expect(markerParserSpy).toHaveBeenCalledWith(
            mockNormalize,
            expect.any(Function),
            commentsArray,
            mockFileReferenceLogger,
        );
    });

    it("should give normalize to null marker to MarkerParser if no normalize function given", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const commentsArray = ["COMMENT1", "COMMENT2"];

        // Act
        const promise = parseFile("file.js", true, commentsArray, NullLogger);
        finishReadingFile();
        const normalizeFunc = markerParserSpy.mock.calls[0][0];
        await promise;
        const result = normalizeFunc("afilename");

        // Assert
        expect(result).toBeNull();
    });

    it("should log error if marker targets containing file", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const mockFileReferenceLogger = setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();

        // Act
        const promise = parseFile("file.js", true, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "file.js", checksum: "TARGET_CHECKSUM1"},
        });
        finishReadingFile();
        await promise;

        // Assert
        expect(mockFileReferenceLogger.error).toHaveBeenCalledWith(
            "Sync-tag 'MARKER_ID1' cannot target itself",
            "LINE_NUMBER1",
        );
    });

    it("should resolve with found markers", async () => {
        // Arrange
        const NullLogger = new Logger();
        setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const promise = parseFile("file.js", true, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "TARGET_FILE1", checksum: "TARGET_CHECKSUM1"},
        });
        addMarkerCb("MARKER_ID2", "ID2_CHECKSUM", {
            LINE_NUMBER2: {file: "TARGET_FILE2", checksum: "TARGET_CHECKSUM2"},
        });
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toEqual({
            MARKER_ID1: {
                fixable: true,
                checksum: "ID1_CHECKSUM",
                targets: {
                    LINE_NUMBER1: {
                        file: "TARGET_FILE1",
                        checksum: "TARGET_CHECKSUM1",
                    },
                },
            },
            MARKER_ID2: {
                fixable: true,
                checksum: "ID2_CHECKSUM",
                targets: {
                    LINE_NUMBER2: {
                        file: "TARGET_FILE2",
                        checksum: "TARGET_CHECKSUM2",
                    },
                },
            },
        });
    });

    it("should output error if marker added multiple times", async () => {
        // Arrange
        const NullLogger = new Logger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const mockFileReferenceLogger = setupFileReferenceLogger();
        const promise = parseFile("file.js", true, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "target.a"},
        });
        addMarkerCb("MARKER_ID1", "ID2_CHECKSUM", {
            LINE_NUMBER2: {file: "target.2"},
        });
        finishReadingFile();
        await promise;

        // Assert
        expect(mockFileReferenceLogger.error).toHaveBeenCalledWith(
            "Sync-tag 'MARKER_ID1' declared multiple times",
            "LINE_NUMBER2",
        );
    });

    it("should use fixable value provided in args", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");

        // Act
        const promise = parseFile("file.js", false, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "TARGET_FILE1", checksum: "TARGET_CHECKSUM1"},
        });
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toEqual({
            MARKER_ID1: {
                fixable: false,
                checksum: "ID1_CHECKSUM",
                targets: {
                    LINE_NUMBER1: {
                        file: "TARGET_FILE1",
                        checksum: "TARGET_CHECKSUM1",
                    },
                },
            },
        });
    });
});
