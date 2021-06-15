// @flow
import fs from "fs";
import readline from "readline";
import * as Ancesdir from "ancesdir";

import * as MarkerParser from "../marker-parser.js";
import * as GetNormalizedTargetFileInfo from "../get-normalized-target-file-info.js";

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
            recordUnterminatedMarkers: jest.fn(),
            parseLine: jest.fn(),
        };
        jest.spyOn(MarkerParser, "default").mockImplementationOnce(
            () => mockParser,
        );
        return mockParser;
    };

    it("should get the rootPath for the file being processes", async () => {
        // Arrange
        setupMarkerParser();

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
        };

        // Act
        await parseFile(options, "file", false);

        // Assert
        expect(ancesdirSpy).toHaveBeenCalledWith("file", "rootmarker");
    });

    it("should record parse error on failure", async () => {
        // Arrange
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
        };

        // Act
        const result = await parseFile(options, "file.js", false);

        // Assert
        expect(result.errors).toContainAllValues([
            {
                code: "could-not-parse",
                reason: "Could not parse file: ERROR_STRING",
            },
        ]);
    });

    it("should resolve with null if zero markers are found", async () => {
        // Arrange
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
        };

        // Act
        const promise = parseFile(options, "file.js", false);
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [],
            readOnly: false,
            markers: null,
            referencedFiles: [],
            lineCount: 0,
        });
    });

    it("should resolve with null on error", async () => {
        // Arrange
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
        };

        // Act
        const result = await parseFile(options, "file.js", false);

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    code: "could-not-parse",
                    reason: "Could not parse file: ERROR_STRING",
                },
            ],
            readOnly: false,
            markers: null,
            referencedFiles: [],
        });
    });

    it("should invoke MarkerParser.parseLine for each line", async () => {
        // Arrange
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
        };

        // Act
        const promise = parseFile(options, "file.js", true);
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

        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
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
        };

        // Act
        const promise = parseFile(options, "file.js", true);
        finishReadingFile();
        await promise;

        // Assert
        expect(markerParserSpy).toHaveBeenCalledWith(
            expect.any(Function),
            expect.any(Function),
            expect.any(Function),
            commentsArray,
        );
    });

    it("should record error if a marker targets its containing file", async () => {
        // Arrange
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
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
        };

        // Act
        const promise = parseFile(options, "file.js", true);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            [1]: {file: "file.js", checksum: "TARGET_CHECKSUM1"},
        });
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    code: "self-targeting",
                    location: {line: 1},
                    reason: "Sync-tag 'MARKER_ID1' cannot target itself",
                },
            ],
            markers: {
                MARKER_ID1: {
                    checksum: "ID1_CHECKSUM",
                    commentEnd: undefined,
                    commentStart: undefined,
                    targets: {
                        "1": {checksum: "TARGET_CHECKSUM1", file: "file.js"},
                    },
                },
            },
            readOnly: true,
            referencedFiles: [],
            lineCount: 0,
        });
    });

    it("should normalize referenced files for marker parser", async () => {
        // Arrange
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(Ancesdir, "default").mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
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
        };

        // Act
        const promise = parseFile(options, "file.js", true);
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

    it("when not read-only, should return referenced files that exist", async () => {
        // Arrange
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(Ancesdir, "default").mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
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
        };

        // Act
        const promise = parseFile(options, "file.js", false);
        const normalizeFn = markerParserSpy.mock.calls[0][0];
        normalizeFn("FILE_REF_A");
        normalizeFn("FILE_REF_B");
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result.referencedFiles).toStrictEqual(["NORMALIZED_B"]);
    });

    it("when read-only, should not return any referenced files", async () => {
        // Arrange
        const fakeInterface = {on: jest.fn()};
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(Ancesdir, "default").mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
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
        };

        // Act
        const promise = parseFile(options, "file.js", true);
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
        };
        const promise = parseFile(options, "file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            [1]: {file: "TARGET_FILE1", checksum: "TARGET_CHECKSUM1"},
        });
        addMarkerCb("MARKER_ID2", "ID2_CHECKSUM", {
            [34]: {file: "TARGET_FILE2", checksum: "TARGET_CHECKSUM2"},
        });
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toEqual({
            errors: [],
            readOnly: false,
            lineCount: 0,
            markers: {
                MARKER_ID1: {
                    checksum: "ID1_CHECKSUM",
                    targets: {
                        [1]: {
                            file: "TARGET_FILE1",
                            checksum: "TARGET_CHECKSUM1",
                        },
                    },
                    commentStart: undefined,
                    commentEnd: undefined,
                },
                MARKER_ID2: {
                    checksum: "ID2_CHECKSUM",
                    targets: {
                        [34]: {
                            file: "TARGET_FILE2",
                            checksum: "TARGET_CHECKSUM2",
                        },
                    },
                    commentStart: undefined,
                    commentEnd: undefined,
                },
            },
            referencedFiles: [],
        });
    });

    it("should record error if marker added multiple times", async () => {
        // Arrange
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
        };
        const promise = parseFile(options, "file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            [1]: {file: "target.a"},
        });
        addMarkerCb("MARKER_ID1", "ID2_CHECKSUM", {
            [1]: {file: "target.2"},
        });
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    code: "duplicate-marker",
                    location: {line: 1},
                    reason: "Sync-tag 'MARKER_ID1' declared multiple times",
                },
            ],
            markers: {
                MARKER_ID1: {
                    checksum: "ID2_CHECKSUM",
                    commentEnd: undefined,
                    commentStart: undefined,
                    targets: {"1": {file: "target.2"}},
                },
            },
            readOnly: false,
            referencedFiles: [],
            lineCount: 0,
        });
    });
});
