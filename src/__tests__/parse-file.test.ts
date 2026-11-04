import * as Ancesdir from "ancesdir";
import * as ReadLines from "../read-lines";
import * as MarkerParser from "../marker-parser";
import * as GetNormalizedPathInfo from "../get-normalized-path-info";
import * as Checksum from "../checksum";

import parseFile from "../parse-file";

import {Options} from "../types";
import {ErrorCode} from "../error-codes";

jest.mock("fs");
jest.mock("../get-normalized-path-info");
jest.mock("ancesdir");

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
            .spyOn(Ancesdir, "closesdir")
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
        jest.spyOn(ReadLines, "default").mockRejectedValueOnce(
            new Error("ERROR_STRING"),
        );
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
        expect(result.errors).toEqual([
            {
                markerID: null,
                code: "could-not-parse",
                reason: "Could not parse root.path/file.js: ERROR_STRING",
            },
        ]);
    });

    it("should record parse error if the parser can't be created", async () => {
        // Arrange
        jest.spyOn(MarkerParser, "default").mockImplementationOnce(() => {
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
        expect(result.errors).toEqual([
            {
                markerID: null,
                code: "could-not-parse",
                reason: "Could not parse root.path/file.js: ERROR_STRING",
            },
        ]);
    });

    it("should record parse error if parsing a line fails", async () => {
        // Arrange
        const mockParser = setupMarkerParser();
        mockParser.parseLine.mockImplementationOnce(() => {
            throw new Error("ERROR_STRING");
        });
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce(["Line1"]);
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
        expect(result.errors).toEqual([
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
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
        jest.spyOn(ReadLines, "default").mockRejectedValueOnce(
            new Error("ERROR_STRING"),
        );
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "Line1",
            "Line2",
        ]);
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
        await promise;

        // Assert
        expect(mockMarkerParser.parseLine).toHaveBeenCalledTimes(2);
        expect(mockMarkerParser.parseLine).toHaveBeenCalledWith("Line1");
        expect(mockMarkerParser.parseLine).toHaveBeenCalledWith("Line2");
    });

    it("should initialize MarkerParser with callbacks, comments, and log", async () => {
        // Arrange
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
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
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
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
        await promise;

        // Assert
        expect(getNormalizedTargetFileInfoSpy).toHaveBeenCalledWith(
            "root.path",
            "FILE_REF",
        );
    });

    it("when not read-only, should return referenced files that exist", async () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
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
        const result = await promise;

        // Assert
        expect(result.referencedFiles).toStrictEqual(["NORMALIZED_B"]);
    });

    it("when read-only, should not return any referenced files", async () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
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
        const result = await promise;

        // Assert
        expect(result.referencedFiles).toStrictEqual([]);
    });

    it("should calculate the content checksum using the marker content", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        const checksumSpy = jest
            .spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
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
        await promise;

        // Assert
        expect(checksumSpy).toHaveBeenCalledWith(["CONTENT_TO_CHECKSUM1"]);
    });

    it("should return NoChecksum for the content checksum when there is no marker content", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(Checksum, "default").mockReturnValueOnce(
            "ID1_SELF_CHECKSUM",
        );
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        const checksumSpy = jest
            .spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        const checksumSpy = jest
            .spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM");
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
        await promise;

        // Assert
        expect(checksumSpy).toHaveBeenCalledWith(["file.js"]);
    });

    it("should resolve with found markers", async () => {
        // Arrange
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        setupMarkerParser();
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM")
            .mockReturnValueOnce("ID2_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID2_SELF_CHECKSUM");
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
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
        jest.spyOn(Checksum, "default")
            .mockReturnValueOnce("ID1_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID1_SELF_CHECKSUM")
            .mockReturnValueOnce("ID2_CONTENT_CHECKSUM")
            .mockReturnValueOnce("ID2_SELF_CHECKSUM");
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

    describe("marker ids that are also Object property names", () => {
        const NAMES = [
            "constructor",
            "toString",
            "hasOwnProperty",
            "__proto__",
        ];
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
        };
        const target = {
            [1]: {
                type: "local" as const,
                target: "target.a",
                checksum: "CHECKSUM_A",
                declaration: "DECLARATION_A",
            },
        };

        it.each(NAMES)(
            "should not record a duplicate marker for the first marker with id %s",
            async (id) => {
                // Arrange
                const markerParserSpy = jest.spyOn(MarkerParser, "default");
                setupMarkerParser();
                jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
                jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
                const promise = parseFile(options, "root.path/file.js", false);
                const addMarkerCb = markerParserSpy.mock.calls[0][1];

                // Act
                addMarkerCb(id, ["CONTENT"], target, "//", "");
                const result = await promise;

                // Assert
                expect(result.errors).toEqual([]);
            },
        );

        it("should return a marker with id __proto__ as an own property", async () => {
            // Arrange
            const markerParserSpy = jest.spyOn(MarkerParser, "default");
            setupMarkerParser();
            jest.spyOn(ReadLines, "default").mockResolvedValueOnce([]);
            jest.spyOn(Ancesdir, "closesdir").mockReturnValue("root.path");
            const promise = parseFile(options, "root.path/file.js", false);
            const addMarkerCb = markerParserSpy.mock.calls[0][1];

            // Act
            addMarkerCb("__proto__", ["CONTENT"], target, "//", "");
            const result = await promise;
            const ownIds = Object.getOwnPropertyNames(result.markers);

            // Assert
            expect(ownIds).toEqual(["__proto__"]);
        });
    });
});
