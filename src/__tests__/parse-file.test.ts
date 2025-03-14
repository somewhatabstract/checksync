import fs from "fs";
import readline from "readline";

import * as AncesdirOrCurrentDir from "../ancesdir-or-currentdir";
import * as MarkerParser from "../marker-parser";
import * as GetNormalizedPathInfo from "../get-normalized-path-info";
import * as Checksum from "../checksum";

import parseFile from "../parse-file";

import {Options} from "../types";
import {ErrorCode} from "../error-codes";

jest.mock("fs");
jest.mock("../get-normalized-path-info");
jest.mock("../ancesdir-or-currentdir");

const invokeEvent = (
    mocked: ReturnType<jest.MockedFunction<any>>,
    event: string,
    ...args: Array<any>
) => {
    const eventHandlerCall = mocked.mock.calls.find(
        (call: any) => call[0] === event,
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
        const mockParser: any = {
            recordUnterminatedMarkers: jest.fn<any, any>(),
            parseLine: jest.fn<any, any>(),
        } as const;
        jest.spyOn(MarkerParser, "default").mockImplementationOnce(
            () => mockParser,
        );
        return mockParser;
    };

    it("should get the rootPath for the file being processes", async () => {
        // Arrange
        setupMarkerParser();

        const ancesdirSpy = jest
            .spyOn(AncesdirOrCurrentDir, "ancesdirOrCurrentDir")
            .mockReturnValue("root.path");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: "rootmarker",
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const result = await parseFile(options, "root.path/file.js", false);

        // Assert
        expect(result.errors).toContainAllValues([
            {
                markerID: null,
                code: "could-not-parse",
                reason: "Could not parse root.path/file.js: ERROR_STRING",
            },
        ]);
    });

    it("should resolve with null if zero markers are found", async () => {
        // Arrange
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", false);
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const result = await parseFile(options, "root.path/file.js", false);

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    markerID: null,
                    code: "could-not-parse",
                    reason: "Could not parse root.path/file.js: ERROR_STRING",
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
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
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

        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
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
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb(
            "MARKER_ID1",
            ["CONTENT_TO_CHECKSUM"],
            {
                [1]: {
                    type: "local",
                    target: "root.path/file.js",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    markerID: "MARKER_ID1",
                    code: "self-targeting",
                    location: {line: 1},
                    reason: "Sync-tag 'MARKER_ID1' cannot target itself",
                },
            ],
            markers: {
                MARKER_ID1: {
                    contentChecksum: "ID1_CONTENT_CHECKSUM",
                    selfChecksum: "ID1_SELF_CHECKSUM",
                    commentEnd: "COMMENT_END",
                    commentStart: "COMMENT_START",
                    targets: {
                        "1": {
                            checksum: "TARGET_CHECKSUM1",
                            target: "root.path/file.js",
                            type: "local",
                            declaration: "DECLARATION",
                        },
                    },
                },
            },
            readOnly: true,
            referencedFiles: [],
            lineCount: 0,
        });
    });

    it("should record empty marker error if allowEmptyTargets is false", async () => {
        // Arrange
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb(
            "MARKER_ID1",
            undefined,
            {
                [1]: {
                    type: "remote",
                    target: "TARGET_1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    markerID: "MARKER_ID1",
                    code: ErrorCode.emptyMarker,
                    location: {line: 1},
                    reason: "Sync-tag 'MARKER_ID1' has no content",
                },
            ],
            markers: expect.any(Object),
            readOnly: true,
            referencedFiles: [],
            lineCount: 0,
        });
    });

    it("should not record empty marker error if allowEmptyTargets is true", async () => {
        // Arrange
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: true,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];
        addMarkerCb(
            "MARKER_ID1",
            undefined,
            {
                [1]: {
                    type: "remote",
                    target: "TARGET_1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [],
            markers: expect.any(Object),
            readOnly: true,
            referencedFiles: [],
            lineCount: 0,
        });
    });

    it("should normalize referenced files for marker parser", async () => {
        // Arrange
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const getNormalizedTargetFileInfoSpy = jest
            .spyOn(GetNormalizedPathInfo, "default")
            .mockReturnValue({path: "file.js", exists: false, type: "local"});
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
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
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(GetNormalizedPathInfo, "default")
            .mockReturnValueOnce({
                path: "NORMALIZED_A",
                exists: false,
                type: "local",
            })
            .mockReturnValueOnce({
                path: "NORMALIZED_B",
                exists: true,
                type: "local",
            });
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", false);
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
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(GetNormalizedPathInfo, "default")
            .mockReturnValueOnce({
                path: "NORMALIZED_A",
                exists: true,
                type: "local",
            })
            .mockReturnValueOnce({
                path: "NORMALIZED_B",
                exists: true,
                type: "local",
            });
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };

        // Act
        const promise = parseFile(options, "root.path/file.js", true);
        const normalizeFn = markerParserSpy.mock.calls[0][0];
        normalizeFn("FILE_REF_A");
        normalizeFn("FILE_REF_B");
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result.referencedFiles).toStrictEqual([]);
    });

    it("should calculate the content checksum using the marker content", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        const checksumSpy = jest
            .spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };
        const promise = parseFile(options, "root.path/file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb(
            "MARKER_ID1",
            ["CONTENT_TO_CHECKSUM1"],
            {
                [1]: {
                    type: "remote",
                    target: "TARGET_1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        await promise;

        // Assert
        expect(checksumSpy).toHaveBeenCalledWith(["CONTENT_TO_CHECKSUM1"]);
    });

    it("should return NoChecksum for the content checksum when there is no marker content", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(Checksum, "default").mockReturnValueOnce(
            "ID1_SELF_CHECKSUM",
        );
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: true,
            cachePath: "",
            cacheMode: "ignore",
        };
        const promise = parseFile(options, "root.path/file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb(
            "MARKER_ID1",
            undefined,
            {
                [1]: {
                    type: "remote",
                    target: "TARGET_1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [],
            markers: {
                MARKER_ID1: {
                    contentChecksum: "No checksum",
                    selfChecksum: "ID1_SELF_CHECKSUM",
                    commentEnd: "COMMENT_END",
                    commentStart: "COMMENT_START",
                    targets: {
                        "1": {
                            type: "remote",
                            target: "TARGET_1",
                            checksum: "TARGET_CHECKSUM1",
                            declaration: "DECLARATION1",
                        },
                    },
                },
            },
            readOnly: false,
            referencedFiles: [],
            lineCount: 0,
        });
    });

    it("should calculate the self checksum using the marker content and the normalized path of the file containing the marker", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        const checksumSpy = jest
            .spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };
        const promise = parseFile(options, "root.path/file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb(
            "MARKER_ID1",
            ["CONTENT_TO_CHECKSUM1"],
            {
                [1]: {
                    type: "remote",
                    target: "TARGET_1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        await promise;

        // Assert
        expect(checksumSpy).toHaveBeenCalledWith([
            "CONTENT_TO_CHECKSUM1",
            "file.js",
        ]);
    });

    it("when no content, should calculate the self checksum using the normalized path of the file containing the marker", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        const checksumSpy = jest
            .spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };
        const promise = parseFile(options, "root.path/file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb(
            "MARKER_ID1",
            undefined,
            {
                [1]: {
                    type: "remote",
                    target: "TARGET_1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        await promise;

        // Assert
        expect(checksumSpy).toHaveBeenCalledWith(["file.js"]);
    });

    it("should resolve with found markers", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM")
            .mockReturnValueOnce("ID2_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID2_SELF_CHECKSUM");
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };
        const promise = parseFile(options, "root.path/file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb(
            "MARKER_ID1",
            ["CONTENT_TO_CHECKSUM1"],
            {
                [1]: {
                    type: "local",
                    target: "TARGET_FILE1",
                    checksum: "TARGET_CHECKSUM1",
                    declaration: "DECLARATION1",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        addMarkerCb(
            "MARKER_ID2",
            ["CONTENT_TO_CHECKSUM2"],
            {
                [34]: {
                    type: "local",
                    target: "TARGET_FILE2",
                    checksum: "TARGET_CHECKSUM2",
                    declaration: "DECLARATION2",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toEqual({
            errors: [],
            readOnly: false,
            lineCount: 0,
            markers: {
                MARKER_ID1: {
                    contentChecksum: "ID1_CONTENT_CHECKSUM",
                    selfChecksum: "ID1_SELF_CHECKSUM",
                    targets: {
                        [1]: {
                            type: "local",
                            target: "TARGET_FILE1",
                            checksum: "TARGET_CHECKSUM1",
                            declaration: "DECLARATION1",
                        },
                    },
                    commentEnd: "COMMENT_END",
                    commentStart: "COMMENT_START",
                },
                MARKER_ID2: {
                    contentChecksum: "ID2_CONTENT_CHECKSUM",
                    selfChecksum: "ID2_SELF_CHECKSUM",
                    targets: {
                        [34]: {
                            type: "local",
                            target: "TARGET_FILE2",
                            checksum: "TARGET_CHECKSUM2",
                            declaration: "DECLARATION2",
                        },
                    },
                    commentEnd: "COMMENT_END",
                    commentStart: "COMMENT_START",
                },
            },
            referencedFiles: [],
        });
    });

    it("should record error if marker added multiple times", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        const fakeInterface: any = {on: jest.fn<any, any>()} as const;
        fakeInterface.on.mockReturnValue(fakeInterface);
        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createReadStream").mockReturnValueOnce(null as any);
        jest.spyOn(readline, "createInterface").mockReturnValueOnce(
            fakeInterface,
        );
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("root.path");
        jest.spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM")
            .mockReturnValueOnce("ID2_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID2_SELF_CHECKSUM");
        const finishReadingFile = () => invokeEvent(fakeInterface.on, "close");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };
        const promise = parseFile(options, "root.path/file.js", false);
        const addMarkerCb = markerParserSpy.mock.calls[0][1];

        // Act
        addMarkerCb(
            "MARKER_ID1",
            ["CONTENT_TO_CHECKSUM1"],
            {
                [1]: {
                    type: "local",
                    target: "target.a",
                    checksum: "CHECKSUM_A",
                    declaration: "DECLARATION_A",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        addMarkerCb(
            "MARKER_ID1",
            ["CONTENT_TO_CHECKSUM2"],
            {
                [1]: {
                    type: "local",
                    target: "target.2",
                    checksum: "CHECKSUM_2",
                    declaration: "DECLARATION_2",
                },
            },
            "COMMENT_START",
            "COMMENT_END",
        );
        finishReadingFile();
        const result = await promise;

        // Assert
        expect(result).toStrictEqual({
            errors: [
                {
                    markerID: "MARKER_ID1",
                    code: "duplicate-marker",
                    location: {line: 1},
                    reason: "Sync-tag 'MARKER_ID1' declared multiple times",
                },
            ],
            markers: {
                MARKER_ID1: {
                    contentChecksum: "ID2_CONTENT_CHECKSUM",
                    selfChecksum: "ID2_SELF_CHECKSUM",
                    commentEnd: "COMMENT_END",
                    commentStart: "COMMENT_START",
                    targets: {
                        "1": {
                            type: "local",
                            target: "target.2",
                            checksum: "CHECKSUM_2",
                            declaration: "DECLARATION_2",
                        },
                    },
                },
            },
            readOnly: false,
            referencedFiles: [],
            lineCount: 0,
        });
    });
});
