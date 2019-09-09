// @flow
import getMarkersFromFiles from "../get-markers-from-files.js";
import * as FileParser from "../file-parser.js";
import Logger from "../logger.js";

jest.mock("../file-parser.js");

const NullLogger = new Logger();

describe("#fromFiles", () => {
    it("should parse each file as fixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(FileParser, "default")
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

    it("should parse each referenced file as unfixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(FileParser, "default")
            .mockImplementation((file, fixable, comments, logger, logCb) => {
                if (file === "a.js") {
                    logCb("b.js");
                }
                return Promise.resolve(file);
            });

        // Act
        await getMarkersFromFiles(["a.js"], ["//"], NullLogger);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            "b.js",
            false,
            ["//"],
            NullLogger,
        );
    });

    it("should not parse already parsed files", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(FileParser, "default")
            .mockImplementation((file, fixable, comments, logger, logCb) => {
                if (file === "a.js") {
                    logCb("b.js");
                    logCb("c.js");
                }
                return Promise.resolve(file);
            });

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
        jest.spyOn(FileParser, "default").mockImplementation(
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

    it("should not include files that had no markers", async () => {
        // Arrange
        jest.spyOn(FileParser, "default").mockImplementation(
            (file, fixable, comments, logger, logCb) => {
                if (file !== "b.js") {
                    return null;
                }
                logCb("c.js");
                return Promise.resolve(file);
            },
        );

        // Act
        const result = await getMarkersFromFiles(
            ["a.js", "b.js"],
            ["//"],
            NullLogger,
        );

        // Assert
        expect(result).toStrictEqual({
            "b.js": "b.js",
        });
    });
});
