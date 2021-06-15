// @flow
import fs from "fs";
import getMarkersFromFiles from "../get-markers-from-files.js";
import * as ParseFile from "../parse-file.js";
import Format from "../format.js";

import type {Options} from "../types.js";

jest.mock("../parse-file.js");
jest.mock("fs");

describe("#fromFiles", () => {
    it("should parse each file as fixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockReturnValue(Promise.resolve());
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(options, "a.js", false);
        expect(parseSpy).toHaveBeenCalledWith(options, "b.js", false);
    });

    it("should parse each existing referenced file as readOnly", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((options, file, readOnly) => {
                if (file === "a.js") {
                    return Promise.resolve({
                        markers: {},
                        referencedFiles: ["referenced.file"],
                    });
                }
                return Promise.resolve({
                    markers: {},
                    referencedFiles: [],
                });
            });
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        await getMarkersFromFiles(options, ["a.js"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(options, "referenced.file", true);
    });

    it("should not parse already parsed files", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((options, file, fixable, logger) => {
                if (file === "a.js") {
                    return Promise.resolve({
                        markers: {},
                        referencedFiles: ["b.js", "c.js"],
                    });
                }
                return Promise.resolve({markers: {}, referencedFiles: []});
            });
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledTimes(3);
        expect(parseSpy).toHaveBeenCalledWith(options, "a.js", false);
        expect(parseSpy).toHaveBeenCalledWith(options, "b.js", false);
        expect(parseSpy).toHaveBeenCalledWith(options, "c.js", true);
    });

    it("should return file cache", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (options, file, readOnly) =>
                Promise.resolve({
                    errors: [],
                    markers: {
                        file,
                    },
                    referencedFiles: [],
                }),
        );
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                errors: [],
                readOnly: false,
                aliases: ["a.js"],
                markers: {
                    file: "a.js",
                },
            },
            "b.js": {
                errors: [],
                readOnly: false,
                aliases: ["b.js"],
                markers: {
                    file: "b.js",
                },
            },
        });
    });

    it("should include files that had no markers", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (options, file, readOnly) => {
                if (file !== "b.js") {
                    return {errors: [], markers: null, referencedFiles: []};
                }
                return Promise.resolve({
                    errors: [],
                    markers: file,
                    referencedFiles: ["c.js"],
                });
            },
        );
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                errors: [],
                markers: {},
                readOnly: false,
                aliases: ["a.js"],
            },
            "b.js": {
                errors: [],
                readOnly: false,
                aliases: ["b.js"],
                markers: "b.js",
            },
            "c.js": {
                errors: [],
                markers: {},
                readOnly: true,
                aliases: ["c.js"],
            },
        });
    });

    it("should record error if the file doesn't exist", async () => {
        // Arrange
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => {
            throw new Error("This isn't a file!");
        });
        jest.spyOn(Format, "cwdFilePath").mockImplementation((f) => f);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                aliases: ["a.js"],
                errors: [
                    {
                        code: "could-not-parse",
                        reason: "Could not parse a.js: This isn't a file!",
                    },
                ],
                markers: {},
                readOnly: false,
            },
            "b.js": {
                aliases: ["b.js"],
                errors: [
                    {
                        code: "could-not-parse",
                        reason: "Could not parse b.js: This isn't a file!",
                    },
                ],
                markers: {},
                readOnly: false,
            },
        });
    });
});
