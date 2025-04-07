import fs from "fs";
import getMarkersFromFiles from "../get-markers-from-files";
import * as ParseFile from "../parse-file";
import Format from "../format";

import {Options} from "../types";

jest.mock("../parse-file");
jest.mock("fs");

describe("#fromFiles", () => {
    it("should parse each file as fixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockReturnValue(Promise.resolve(undefined as any));
        jest.spyOn(fs, "realpathSync").mockImplementation((a: any) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
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
                    } as any);
                }
                return Promise.resolve({
                    markers: {},
                    referencedFiles: [],
                });
            });
        jest.spyOn(fs, "realpathSync").mockImplementation((a: any) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
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
            .mockImplementation((options, file, readOnly) => {
                if (file === "a.js") {
                    return Promise.resolve({
                        markers: {},
                        referencedFiles: ["b.js", "c.js"],
                    } as any);
                }
                return Promise.resolve({markers: {}, referencedFiles: []});
            });
        jest.spyOn(fs, "realpathSync").mockImplementation((a: any) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledTimes(3);
        expect(parseSpy).toHaveBeenCalledWith(options, "a.js", false);
        expect(parseSpy).toHaveBeenCalledWith(options, "b.js", false);
        expect(parseSpy).toHaveBeenCalledWith(options, "c.js", true);
    });

    it("should cache symlinked files of already parsed files as read only", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((options, file, readOnly) => {
                if (file === "a.js") {
                    return Promise.resolve({
                        markers: {},
                        referencedFiles: ["c.js"],
                    } as any);
                }
                return Promise.resolve({markers: {}, referencedFiles: []});
            });
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => "a.js");
        const options: Options = {
            includeGlobs: ["a.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(options, "a.js", false);
        expect(parseSpy).not.toHaveBeenCalledWith(options, "b.js", false);
        expect(result).toStrictEqual({
            "a.js": {
                aliases: ["a.js", "b.js", "c.js"],
                errors: undefined,
                lineCount: undefined,
                markers: {},
                readOnly: false,
            },
            "b.js": {
                aliases: ["a.js", "b.js", "c.js"],
                errors: undefined,
                lineCount: undefined,
                markers: {},
                readOnly: true,
            },
            "c.js": {
                aliases: ["a.js", "b.js", "c.js"],
                errors: undefined,
                lineCount: undefined,
                markers: {},
                readOnly: true,
            },
        });
    });

    it("should always parse real file path, not symlink path", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((options, file, readOnly) => {
                if (file === "b_real.js") {
                    return Promise.resolve({
                        markers: {},
                        referencedFiles: ["c.js"],
                    } as any);
                }
                return Promise.resolve({markers: {}, referencedFiles: []});
            });
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => "b_real.js");
        const options: Options = {
            includeGlobs: ["a_symlink.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, [
            "a_symlink.js",
            "b_real.js",
        ]);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(options, "b_real.js", false);
        expect(parseSpy).not.toHaveBeenCalledWith(
            options,
            "a_symlink.js",
            false,
        );
        expect(result).toStrictEqual({
            "a_symlink.js": {
                aliases: ["b_real.js", "a_symlink.js", "c.js"],
                errors: undefined,
                lineCount: undefined,
                markers: {},
                readOnly: true,
            },
            "b_real.js": {
                aliases: ["b_real.js", "a_symlink.js", "c.js"],
                errors: undefined,
                lineCount: undefined,
                markers: {},
                readOnly: false,
            },
            "c.js": {
                aliases: ["b_real.js", "a_symlink.js", "c.js"],
                errors: undefined,
                lineCount: undefined,
                markers: {},
                readOnly: true,
            },
        });
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
                } as any),
        );
        jest.spyOn(fs, "realpathSync").mockImplementation((a: any) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                lineCount: undefined,
                errors: [],
                readOnly: false,
                aliases: ["a.js"],
                markers: {
                    file: "a.js",
                },
            },
            "b.js": {
                lineCount: undefined,
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
                    return Promise.resolve({
                        errors: [],
                        markers: null,
                        referencedFiles: [],
                    } as any);
                }
                return Promise.resolve({
                    errors: [],
                    markers: file,
                    referencedFiles: ["c.js"],
                });
            },
        );
        jest.spyOn(fs, "realpathSync").mockImplementation((a: any) => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                lineCount: undefined,
                errors: [],
                markers: {},
                readOnly: false,
                aliases: ["a.js"],
            },
            "b.js": {
                lineCount: undefined,
                errors: [],
                readOnly: false,
                aliases: ["b.js"],
                markers: "b.js",
            },
            "c.js": {
                lineCount: undefined,
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
            ignoreFiles: [],
            json: false,
            allowEmptyTags: false,
            cachePath: "",
            cacheMode: "ignore",
            includeDotPaths: false,
        };

        // Act
        const result = await getMarkersFromFiles(options, ["a.js", "b.js"]);

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                aliases: ["a.js"],
                errors: [
                    {
                        markerID: null,
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
                        markerID: null,
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
