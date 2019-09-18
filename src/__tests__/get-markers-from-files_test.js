// @flow
import fs from "fs";
import path from "path";
import getMarkersFromFiles from "../get-markers-from-files.js";
import * as ParseFile from "../parse-file.js";
import Logger from "../logger.js";
import * as Ancesdir from "ancesdir";

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

        // Act
        await getMarkersFromFiles(null, ["a.js", "b.js"], ["//"], NullLogger);

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
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        const pathSpy = jest
            .spyOn(path, "join")
            .mockReturnValue("resolved.path");
        jest.spyOn(path, "normalize").mockReturnValue("normalized.path");
        const ancesdirSpy = jest
            .spyOn(Ancesdir, "default")
            .mockReturnValue("file.dirname");

        // Act
        await getMarkersFromFiles(null, ["a.js"], ["//"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            "normalized.path",
            false,
            ["//"],
            NullLogger,
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
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);

        // Act
        await getMarkersFromFiles(null, ["a.js", "b.js"], ["//"], NullLogger);

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

        // Act
        const result = await getMarkersFromFiles(
            null,
            ["a.js", "b.js"],
            ["//"],
            NullLogger,
        );

        // Assert
        expect(result).toStrictEqual({
            "a.js": {
                file: "a.js",
                fixable: true,
            },
            "b.js": {
                file: "b.js",
                fixable: true,
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
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);

        // Act
        const result = await getMarkersFromFiles(
            "marker",
            ["a.js", "b.js"],
            ["//"],
            NullLogger,
        );

        // Assert
        expect(result).toStrictEqual({
            "a.js": null,
            "b.js": "b.js",
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
        jest.spyOn(fs, "existsSync").mockImplementation(f => f === "a.js");
        jest.spyOn(fs, "lstatSync").mockReturnValue({isFile: () => true});
        jest.spyOn(path, "join").mockImplementation((a, b) => b);
        jest.spyOn(path, "normalize").mockImplementation(b => b);

        // Act
        await getMarkersFromFiles(null, ["a.js", "b.js"], ["//"], NullLogger);

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
});
