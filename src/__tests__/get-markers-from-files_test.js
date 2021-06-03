// @flow
import fs from "fs";
import getMarkersFromFiles from "../get-markers-from-files.js";
import * as ParseFile from "../parse-file.js";
import Logger from "../logger.js";
import * as CloneAsFixable from "../clone-as-unfixable.js";
import Format from "../format.js";

import type {Options} from "../types.js";

jest.mock("../parse-file.js");
jest.mock("fs");

const NullLogger = new Logger();

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
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            options,
            "a.js",
            true,
            NullLogger,
        );
        expect(parseSpy).toHaveBeenCalledWith(
            options,
            "b.js",
            true,
            NullLogger,
        );
    });

    it("should parse each existing referenced file as unfixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((options, file, fixable, logger) => {
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
        await getMarkersFromFiles(options, ["a.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            options,
            "referenced.file",
            false,
            NullLogger,
        );
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
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledTimes(3);
        expect(parseSpy).toHaveBeenCalledWith(
            options,
            "a.js",
            true,
            NullLogger,
        );
        expect(parseSpy).toHaveBeenCalledWith(
            options,
            "b.js",
            true,
            NullLogger,
        );
        expect(parseSpy).toHaveBeenCalledWith(
            options,
            "c.js",
            false,
            NullLogger,
        );
    });

    it("should return file cache", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (options, file, fixable) =>
                Promise.resolve({
                    markers: {
                        file,
                        fixable,
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
        const result = await getMarkersFromFiles(
            options,
            ["a.js", "b.js"],
            NullLogger,
        );

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                aliases: ["a.js"],
                markers: {
                    file: "a.js",
                    fixable: true,
                },
            },
            "b.js": {
                aliases: ["b.js"],
                markers: {
                    file: "b.js",
                    fixable: true,
                },
            },
        });
    });

    it("should include files that had no markers", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (options, file, fixable, logger) => {
                if (file !== "b.js") {
                    return {markers: null, referencedFiles: []};
                }
                return Promise.resolve({
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
        const result = await getMarkersFromFiles(
            options,
            ["a.js", "b.js"],
            NullLogger,
        );

        // Assert
        expect(result).toStrictEqual({
            "a.js": null,
            "b.js": {aliases: ["b.js"], markers: "b.js"},
            "c.js": null,
        });
    });

    it("should clone existing file markers if the target of a symlink is already parsed", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (options, file, fixable, logger) => {
                if (file !== "a.js") {
                    return Promise.resolve({
                        markers: file,
                        referencedFiles: ["b.js", "c.js"],
                    });
                }
                return Promise.resolve({
                    markers: file,
                    referencedFiles: [],
                });
            },
        );
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => {
            // When we get to file c.js, which is referenced rather than in the
            // original file set, it is being processed after a and b.
            // We return that it is the same path as a.js, and hence an alias.
            // That means that rather than parse c.js, we'll clone a.js markers.
            if (a === "c.js") {
                return "a.js";
            }
            return a;
        });
        const cloneSpy = jest.spyOn(CloneAsFixable, "default");
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
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(cloneSpy).toHaveBeenCalledWith({
            aliases: ["a.js", "c.js"],
            markers: "a.js",
        });
    });

    it("should clone symlink parsed file markers to real target", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (options, file, fixable, logger) => {
                if (file !== "a.js") {
                    return Promise.resolve({
                        markers: file,
                        referencedFiles: ["b.js", "c.js"],
                    });
                }
                return Promise.resolve({
                    markers: file,
                    referencedFiles: [],
                });
            },
        );
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => {
            // When we get to file a.js, which is in the original file set
            // we report that it is a symlink to c.js.
            // This means that after we parse a.js, we'll clone its markers
            // for c.js too.
            if (a === "a.js") {
                return "c.js";
            }
            return a;
        });
        const cloneSpy = jest.spyOn(CloneAsFixable, "default");
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
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(cloneSpy).toHaveBeenCalledWith({
            aliases: ["a.js", "c.js"],
            markers: "a.js",
        });
    });

    it("should log an error if the file doesn't exist", async () => {
        // Arrange
        jest.spyOn(fs, "realpathSync").mockImplementation((a) => {
            throw new Error("This isn't a file!");
        });
        jest.spyOn(Format, "cwdFilePath").mockImplementation((f) => f);
        const logSpy = jest.spyOn(NullLogger, "error");
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
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith("Cannot parse file: a.js");
    });
});
