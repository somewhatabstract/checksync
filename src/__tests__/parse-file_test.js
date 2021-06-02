// @flow
import fs from "fs";
import readline from "readline";
import * as Ancesdir from "ancesdir";

import * as MarkerParser from "../marker-parser.js";
import * as FileReferenceLogger from "../file-reference-logger.js";
import * as GetNormalizedTargetFileInfo from "../get-normalized-target-file-info.js";

import Logger from "../logger.js";
import parseFile from "../parse-file.js";

import type {Options} from "../types.js";

jest.mock("fs");
jest.mock("ancesdir");
jest.mock("../get-normalized-target-file-info.js");

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

describe("#parseFile", () => {
    const setupMarkerParser = function () {
        const mockParser = {
            reportUnterminatedMarkers: jest.fn(),
            parseLine: jest.fn(),
        };
        jest.spyOn(MarkerParser, "default").mockImplementationOnce(
            () => mockParser,
        );
        return mockParser;
    };

    const setupFileReferenceLogger = function () {
        const mockFileReferenceLogger = {
            error: jest.fn(),
        };
        jest.spyOn(FileReferenceLogger, "default").mockImplementationOnce(
            () => mockFileReferenceLogger,
        );
        return mockFileReferenceLogger;
    };

    it("should get the rootPath for the file being processes", async () => {
        // Arrange
        setupMarkerParser();
        setupFileReferenceLogger();
        const NullLogger = new Logger();
        const ancesdirSpy = jest
            .spyOn(Ancesdir, "default")
            .mockReturnValue("file.dirname");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: "rootmarker",
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        await parseFile(options, "file", false, NullLogger);

        // Assert
        expect(ancesdirSpy).toHaveBeenCalledWith("file", "rootmarker");
    });

    it("should create scoped logger for file", async () => {
        // Arrange
        setupMarkerParser();
        setupFileReferenceLogger();
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const fileRefLoggerSpy = jest.spyOn(FileReferenceLogger, "default");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
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
        jest.spyOn(fs, "openSync").mockImplementationOnce(() => {
            throw new Error("ERROR_STRING");
        });
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        await parseFile(options, "file.js", true, NullLogger);

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
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({markers: null, referencedFiles: []});
        expect(logger.error).not.toHaveBeenCalled(); // <- Verifies we're testing success
    });

    it("should resolve with null on error", async () => {
        // Arrange
        const NullLogger = new Logger();
        const mockFileReferenceLogger = setupFileReferenceLogger();
        jest.spyOn(fs, "openSync").mockImplementationOnce(() => {
            throw new Error("ERROR_STRING");
        });
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const result = await parseFile(options, "file.js", true, NullLogger);

        // Assert
        expect(result).toStrictEqual({markers: null, referencedFiles: []});
        expect(mockFileReferenceLogger.error).toHaveBeenCalled(); // <- Verifies we're testing failure
    });

    it("should invoke MarkerParser.parseLine for each line", async () => {
        // Arrange
        const NullLogger = new Logger();
        const mockMarkerParser = setupMarkerParser();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const readLine = (line: string) =>
            invokeEvent(fakeInterface.on, "line", line);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
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
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const mockFileReferenceLogger = setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const commentsArray = ["COMMENT1", "COMMENT2"];
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: commentsArray,
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
        finishReadingFile();
        await promise;

        // Assert
        expect(markerParserSpy).toHaveBeenCalledWith(
            expect.any(Function),
            expect.any(Function),
            commentsArray,
            mockFileReferenceLogger,
        );
    });

    it("should log error if a marker targets its containing file", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const mockFileReferenceLogger = setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
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

    it("should normalize referenced files for marker parser", async () => {
        // Arrange
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(Ancesdir, "default").mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const getNormalizedTargetFileInfoSpy = jest
            .spyOn(GetNormalizedTargetFileInfo, "default")
            .mockReturnValue({file: "NORMALIZED", exists: false});
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
        const normalizeFn = markerParserSpy.mock.calls[0][0];
        normalizeFn("FILE_REF");
        finishReadingFile();
        await promise;

        // Assert
        expect(getNormalizedTargetFileInfoSpy).toHaveBeenCalledWith(
            "root.path",
            "FILE_REF",
        );
    });

    it("when fixable, should return referenced files that exist", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(Ancesdir, "default").mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(GetNormalizedTargetFileInfo, "default")
            .mockReturnValueOnce({file: "NORMALIZED_A", exists: false})
            .mockReturnValueOnce({file: "NORMALIZED_B", exists: true});
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", true, NullLogger);
        const normalizeFn = markerParserSpy.mock.calls[0][0];
        normalizeFn("FILE_REF_A");
        normalizeFn("FILE_REF_B");
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result.referencedFiles).toStrictEqual(["NORMALIZED_B"]);
    });

    it("when not fixable, should not return any referenced files", async () => {
        // Arrange
        const NullLogger = new Logger();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(Ancesdir, "default").mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(GetNormalizedTargetFileInfo, "default")
            .mockReturnValueOnce({file: "NORMALIZED_A", exists: true})
            .mockReturnValueOnce({file: "NORMALIZED_B", exists: true});
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", false, NullLogger);
        const normalizeFn = markerParserSpy.mock.calls[0][0];
        normalizeFn("FILE_REF_A");
        normalizeFn("FILE_REF_B");
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result.referencedFiles).toStrictEqual([]);
    });

    it("should resolve with found markers", async () => {
        // Arrange
        const NullLogger = new Logger();
        setupFileReferenceLogger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };
        const promise = parseFile(options, "file.js", true, NullLogger);
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
            markers: {
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
            },
            referencedFiles: [],
        });
    });

    it("should output error if marker added multiple times", async () => {
        // Arrange
        const NullLogger = new Logger();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const mockFileReferenceLogger = setupFileReferenceLogger();
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };
        const promise = parseFile(options, "file.js", true, NullLogger);
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
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: false,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
            silent: false,
        };

        // Act
        const promise = parseFile(options, "file.js", false, NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "TARGET_FILE1", checksum: "TARGET_CHECKSUM1"},
        });
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toEqual({
            markers: {
                MARKER_ID1: {
                    fixable: false,
                    checksum: "ID1_CHECKSUM",
                    comment: undefined,
                    targets: {
                        LINE_NUMBER1: {
                            file: "TARGET_FILE1",
                            checksum: "TARGET_CHECKSUM1",
                        },
                    },
                },
            },
            referencedFiles: [],
        });
    });
});
