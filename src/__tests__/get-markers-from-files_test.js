// @flow
import fs from "fs";
import path from "path";
import getMarkersFromFiles from "../get-markers-from-files.js";
import * as ParseFile from "../parse-file.js";
import Logger from "../logger.js";

jest.mock("../parse-file.js");
jest.mock("path");
jest.mock("fs");

const NullLogger = new Logger();

describe("#fromFiles", () => {
    it("should parse each file as fixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(ParseFile, "default")
            .mockReturnValue(Promise.resolve());

        // Act
        await getMarkersFromFiles(["a.js", "b.js"], ["//"], NullLogger);

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
        const pathResolveSpy = jest
            .spyOn(path, "resolve")
            .mockReturnValue("resolved.path");
        const pathDirnameSpy = jest
            .spyOn(path, "dirname")
            .mockReturnValue("file.dirname");

        // Act
        await getMarkersFromFiles(["a.js"], ["//"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            "resolved.path",
            false,
            ["//"],
            NullLogger,
        );
        expect(pathResolveSpy).toHaveBeenCalledWith("file.dirname", "b.js");
        expect(pathDirnameSpy).toHaveBeenCalledWith("a.js");
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
        jest.spyOn(path, "resolve").mockImplementation((a, b) => b);
        jest.spyOn(path, "dirname").mockReturnValue("");

        // Act
        await getMarkersFromFiles(["a.js", "b.js"], ["//"], NullLogger);

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
        jest.spyOn(path, "resolve").mockImplementation((a, b) => b);
        jest.spyOn(path, "dirname").mockReturnValue("");

        // Act
        const result = await getMarkersFromFiles(
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
        jest.spyOn(path, "resolve").mockImplementation((a, b) => b);
        jest.spyOn(path, "dirname").mockReturnValue("");

        // Act
        await getMarkersFromFiles(["a.js", "b.js"], ["//"], NullLogger);

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
