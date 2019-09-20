// @flow
import fs from "fs";
import path from "path";
import getMarkersFromFiles from "../get-markers-from-files.js";
import * as ParseFile from "../parse-file.js";
import Logger from "../logger.js";
import * as Ancesdir from "ancesdir";
import * as CloneAsFixable from "../clone-as-unfixable.js";

import type {Options} from "../types.js";

jest.mock("../parse-file.js");
jest.mock("path");
jest.mock("fs");
jest.mock("ancesdir");

const NullLogger = new Logger();

describe("#fromFiles", () => {
    it("should parse each file as fixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockReturnValue(Promise.resolve());
        jest.spyOn(fs, "realpathSync").mockImplementation(a => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            "a.js",
            true,
            ["//"],
            NullLogger,
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith(
            "b.js",
            true,
            ["//"],
            NullLogger,
            expect.any(Function),
        );
    });

    it("should parse each existing referenced file as unfixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((file, fixable, comments, logger, logCb) => {
                if (file === "a.js") {
                    logCb("b.js");
                }
                return Promise.resolve(file);
            });
        jest.spyOn(fs, "realpathSync").mockImplementation(a => a);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        const pathSpy = jest
            .spyOn(path, "join")
            .mockReturnValue("resolved.path");
        jest.spyOn(path, "normalize").mockReturnValue("normalized.path");
        const ancesdirSpy = jest
            .spyOn(Ancesdir, "default")
            .mockReturnValue("file.dirname");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        await getMarkersFromFiles(options, ["a.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            "normalized.path",
            false,
            ["//"],
            NullLogger,
            null,
        );
        expect(pathSpy).toHaveBeenCalledWith("file.dirname", "b.js");
        expect(ancesdirSpy).toHaveBeenCalledWith("a.js", null);
    });

    it("should not parse already parsed files", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((file, fixable, comments, logger, logCb) => {
                if (file === "a.js") {
                    logCb("b.js");
                    logCb("c.js");
                }
                return Promise.resolve(file);
            });
        jest.spyOn(fs, "realpathSync").mockImplementation(a => a);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledTimes(3);
        expect(parseSpy).toHaveBeenCalledWith(
            "a.js",
            true,
            ["//"],
            NullLogger,
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith(
            "b.js",
            true,
            ["//"],
            NullLogger,
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith(
            "c.js",
            false,
            ["//"],
            NullLogger,
            null,
        );
    });

    it("should return file cache", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (file, fixable, logCb) =>
                Promise.resolve({
                    file,
                    fixable,
                }),
        );
        jest.spyOn(fs, "realpathSync").mockImplementation(a => a);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
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
            (file, fixable, comments, logger, logCb) => {
                if (file !== "b.js") {
                    return null;
                }
                logCb("c.js");
                return Promise.resolve(file);
            },
        );
        jest.spyOn(fs, "realpathSync").mockImplementation(a => a);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
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

    it("should not try to load files that do not exist", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockImplementation((file, fixable, comments, logger, logCb) => {
                if (file !== "b.js") {
                    return null;
                }
                logCb("c.js");
                return Promise.resolve(file);
            });
        jest.spyOn(fs, "realpathSync").mockImplementation(a => a);
        jest.spyOn(fs, "existsSync").mockImplementation(f => f === "a.js");
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledTimes(2);
        expect(parseSpy).toHaveBeenCalledWith(
            "a.js",
            true,
            ["//"],
            NullLogger,
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith(
            "b.js",
            true,
            ["//"],
            NullLogger,
            expect.any(Function),
        );
    });

    it("should clone existing file markers if the target of a symlink is already parsed", async () => {
        // Arrange
        jest.spyOn(ParseFile, "default").mockImplementation(
            (file, fixable, comments, logger, logCb) => {
                if (file === "a.js") {
                    logCb("b.js");
                    logCb("c.js");
                }
                return Promise.resolve(file);
            },
        );
        jest.spyOn(fs, "realpathSync").mockImplementation(a => {
            if (a === "c.js") {
                return "a.js";
            }
            return a;
        });
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);
        const cloneSpy = jest.spyOn(CloneAsFixable, "default");
        const options: Options = {
            includeGlobs: ["a.js", "b.js"],
            comments: ["//"],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
        };

        // Act
        await getMarkersFromFiles(options, ["a.js", "b.js"], NullLogger);

        // Assert
        expect(cloneSpy).toHaveBeenCalledWith({
            aliases: ["a.js", "c.js"],
            markers: "a.js",
        });
    });

    it("should clone symlink parsed file markers to real target", () => {});

    it("should log an error if the file doesn't exist", () => {});
});
