// @flow
import fs from "fs";
import * as FastGlob from "fast-glob";

import getFiles from "../get-files.js";

jest.mock("fast-glob");
jest.mock("fs");

describe("#getFiles", () => {
    it("should append directories with /**", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isDirectory: () => true});
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["directory"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["directory/**"],
            expect.any(Object),
        );
    });

    it("should not append /** if the pattern does not exist", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(false);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["pattern"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["pattern"], expect.any(Object));
    });

    it("should not append /** if the pattern exists but is not a directory", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isDirectory: () => false});
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["pattern"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["pattern"], expect.any(Object));
    });

    it("should dedupe globs", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(false);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        await getFiles(["pattern1", "pattern1"], ["exclude1", "exclude1"]);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["pattern1"], expect.any(Object));
    });

    it("should return a sorted list without duplicates", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(false);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        const result = await getFiles(["pattern1", "pattern2"], []);

        // Assert
        expect(result).toEqual(["a", "b", "c", "d"]);
        expect(globSpy).toHaveBeenCalledTimes(1);
    });

    it("should exclude files matched by exclude globs", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(false);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        await getFiles(["pattern1"], ["a", "c"]);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["pattern1"],
            expect.objectContaining({ignore: ["a", "c"]}),
        );
    });
});
