// @flow
import {fromFiles} from "../marker-cache.js";
import * as FileParser from "../file-parser.js";

jest.mock("../file-parser.js");

describe("#fromFiles", () => {
    it("should parse each file as fixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(FileParser, "default")
            .mockReturnValue(Promise.resolve());

        // Act
        await fromFiles(["a.js", "b.js"], ["//"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(
            "a.js",
            true,
            ["//"],
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith(
            "b.js",
            true,
            ["//"],
            expect.any(Function),
        );
    });

    it("should parse each referenced file as unfixable", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(FileParser, "default")
            .mockImplementation(
                (
                    file: string,
                    fixable: boolean,
                    comments: string,
                    logCb: string => void,
                ) => {
                    if (file === "a.js") {
                        logCb("b.js");
                    }
                    return Promise.resolve(file);
                },
            );

        // Act
        await fromFiles(["a.js"], ["//"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith("b.js", false, ["//"]);
    });

    it("should not parse already parsed files", async () => {
        // Arrange
        const parseSpy = jest
            .spyOn(FileParser, "default")
            .mockImplementation(
                (
                    file: string,
                    fixable: boolean,
                    comments: string,
                    logCb: string => void,
                ) => {
                    if (file === "a.js") {
                        logCb("b.js");
                        logCb("c.js");
                    }
                    return Promise.resolve(file);
                },
            );

        // Act
        await fromFiles(["a.js", "b.js"], ["//"]);

        // Assert
        expect(parseSpy).toHaveBeenCalledTimes(3);
        expect(parseSpy).toHaveBeenCalledWith(
            "a.js",
            true,
            ["//"],
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith(
            "b.js",
            true,
            ["//"],
            expect.any(Function),
        );
        expect(parseSpy).toHaveBeenCalledWith("c.js", false, ["//"]);
    });

    it("should return file cache", async () => {
        // Arrange
        jest.spyOn(FileParser, "default").mockImplementation(
            (file: string, fixable: boolean, logCb: string => void) =>
                Promise.resolve({
                    file,
                    fixable,
                }),
        );

        // Act
        const result = await fromFiles(["a.js", "b.js"], ["//"]);

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
});
