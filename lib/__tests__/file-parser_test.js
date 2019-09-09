// @flow
import fs from "fs";
import {Readable} from "stream";

import * as MarkerParser from "../marker-parser.js";

import {NullLogger} from "../logging.js";
import parseFile from "../file-parser.js";
import chalk from "chalk";

jest.mock("../marker-parser.js");

describe("#parseFile", () => {
    const mockMarkerParser = {
        getOpenMarkerIDs: jest.fn(),
        parseLine: jest.fn(),
    };
    const resetMarkerParser = () => {
        jest.spyOn(MarkerParser, "default").mockImplementation(
            (...args) => mockMarkerParser,
        );
        mockMarkerParser.getOpenMarkerIDs.mockReturnValue([]);
    };

    /**
     * Helper to create a fake file stream and set that as the mock response for
     * `fs.createReadStream`.
     */
    const mockFakeFile = () => {
        const fakeFile = new Readable();
        /**
         * This noop is needed or we can get an error output:
         *   https://stackoverflow.com/a/22085851
         * $FlowFixMe
         */
        fakeFile._read = () => {};
        jest.spyOn(fs, "createReadStream").mockReturnValue(fakeFile);
        return fakeFile;
    };

    beforeEach(() => {
        chalk.enabled = false;
        resetMarkerParser();
    });

    it("should open logging group for file", async () => {
        // Arrange
        const fakeFile = mockFakeFile();
        fakeFile.push(null); // <- End of file

        const logSpy = jest.spyOn(NullLogger, "group");

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("Parsing"),
            "file.js",
        );
    });

    it("should close logging group for file on failure", async () => {
        // Arrange
        jest.spyOn(fs, "createReadStream").mockImplementation(() => {
            throw new Error("The file wasn't found!");
        });
        const errorSpy = jest.spyOn(NullLogger, "error");
        const groupEndSpy = jest.spyOn(NullLogger, "groupEnd");

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(groupEndSpy).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled(); // <- Verifies we're testing failure
    });

    it("should close logging group for file on success", async () => {
        // Arrange
        const fakeFile = mockFakeFile();
        fakeFile.push(null); // <- End of file
        const errorSpy = jest.spyOn(NullLogger, "error");
        const groupEndSpy = jest.spyOn(NullLogger, "groupEnd");

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(groupEndSpy).toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled(); // <- Verifies we're testing success
    });

    it("should log parse error on failure", async () => {
        // Arrange
        jest.spyOn(fs, "createReadStream").mockImplementation(() => {
            throw new Error("ERROR_STRING");
        });
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "Could not parse file: ERROR_STRING",
        );
    });

    it("should resolve with null if zero markers are found", async () => {
        // Arrange
        const fakeFile = mockFakeFile();
        fakeFile.push(null); // <-- end-of-file
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        const result = await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(result).toBeNull();
        expect(errorSpy).not.toHaveBeenCalled(); // <- Verifies we're testing success
    });

    it("should resolve with null on error", async () => {
        // Arrange
        jest.spyOn(fs, "createReadStream").mockImplementation(() => {
            throw new Error("ERROR_STRING");
        });
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        const result = await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(result).toBeNull();
        expect(errorSpy).toHaveBeenCalled(); // <- Verifies we're testing failure
    });

    it("should invoke MarkerParser.parseLine for each line", async () => {
        // Arrange
        const mockFile = mockFakeFile();
        mockFile.push("Line1\n");
        mockFile.push("Line2\n");
        mockFile.push(null); // <- End of file

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(mockMarkerParser.parseLine).toHaveBeenCalledTimes(2);
        expect(mockMarkerParser.parseLine).toHaveBeenCalledWith("Line1");
        expect(mockMarkerParser.parseLine).toHaveBeenCalledWith("Line2");
    });

    it("should initialize MarkerParser with callback, comments, and log", async () => {
        // Arrange
        const mockFile = mockFakeFile();
        mockFile.push(null); // <- End of file
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        const commentsArray = ["COMMENT1", "COMMENT2"];

        // Act
        await parseFile("file.js", true, commentsArray, NullLogger);

        // Assert
        expect(markerParserSpy).toHaveBeenCalledWith(
            expect.any(Function),
            commentsArray,
            NullLogger,
        );
    });

    it("should resolve with found markers", async () => {
        // Arrange
        const mockFile = mockFakeFile();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");

        // Act
        const promise = parseFile("file.js", true, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][0];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "TARGET_FILE1", checksum: "TARGET_CHECKSUM1"},
        });
        addMarkerCb("MARKER_ID2", "ID2_CHECKSUM", {
            LINE_NUMBER2: {file: "TARGET_FILE2", checksum: "TARGET_CHECKSUM2"},
        });
        mockFile.push(null); // <- End of file
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
        const mockFile = mockFakeFile();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        const promise = parseFile("file.js", true, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][0];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {});
        addMarkerCb("MARKER_ID1", "ID2_CHECKSUM", {});
        mockFile.push(null); // <- End of file
        await promise;

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "Marker declared multiple times: MARKER_ID1",
        );
    });

    it("should use fixable value provided in args", async () => {
        // Arrange
        const mockFile = mockFakeFile();
        const markerParserSpy = jest.spyOn(MarkerParser, "default");

        // Act
        const promise = parseFile("file.js", false, [], NullLogger);
        const addMarkerCb = markerParserSpy.mock.calls[0][0];
        addMarkerCb("MARKER_ID1", "ID1_CHECKSUM", {
            LINE_NUMBER1: {file: "TARGET_FILE1", checksum: "TARGET_CHECKSUM1"},
        });
        mockFile.push(null); // <- End of file
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

    it("should output error group if markers not terminated", async () => {
        // Arrange
        const mockFile = mockFakeFile();
        mockFile.push(null); // <- End of file
        mockMarkerParser.getOpenMarkerIDs.mockReturnValue([
            "MARKER_ID1",
            "MARKER_ID2",
        ]);
        const groupSpy = jest.spyOn(NullLogger, "group");
        const groupEndSpy = jest.spyOn(NullLogger, "groupEnd");
        const logSpy = jest.spyOn(NullLogger, "log");

        // Act
        await parseFile("file.js", true, [], NullLogger);

        // Assert
        expect(groupSpy).toHaveBeenCalledWith(
            " ERROR  Not all markers were terminated",
        );
        expect(logSpy).toHaveBeenCalledWith("MARKER_ID1");
        expect(logSpy).toHaveBeenCalledWith("MARKER_ID2");
        expect(groupEndSpy).toHaveBeenCalled();
    });
});
