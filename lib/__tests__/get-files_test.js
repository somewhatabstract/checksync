// @flow
import fs from "fs";
import * as Glob from "glob";

import getFiles from "../get-files.js";

jest.mock("glob");
jest.mock("fs");

describe("#getFiles", () => {
    it("should append directories with /**", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isDirectory: () => true});
        const globSpy = jest
            .spyOn(Glob, "default")
            .mockImplementation((pattern, opts, cb) => {
                cb(null, []);
            });

        // Act
        await getFiles(["directory"]);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            "directory/**",
            expect.any(Object),
            expect.any(Function),
        );
    });

    it("should not append /** if the pattern does not exist", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(false);
        const globSpy = jest
            .spyOn(Glob, "default")
            .mockImplementation((pattern, opts, cb) => {
                cb(null, []);
            });

        // Act
        await getFiles(["pattern"]);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            "pattern",
            expect.any(Object),
            expect.any(Function),
        );
    });

    it("should not append /** if the pattern exists but is not a directory", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({isDirectory: () => false});
        const globSpy = jest
            .spyOn(Glob, "default")
            .mockImplementation((pattern, opts, cb) => {
                cb(null, []);
            });

        // Act
        await getFiles(["pattern"]);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            "pattern",
            expect.any(Object),
            expect.any(Function),
        );
    });

    it("should return a sorted list without duplicates", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(false);
        const globSpy = jest
            .spyOn(Glob, "default")
            .mockImplementation((pattern, opts, cb) => {
                cb(null, ["c", "a", "d", "b"]);
            });

        // Act
        const result = await getFiles(["pattern1", "pattern2"]);

        // Assert
        expect(result).toEqual(["a", "b", "c", "d"]);
        expect(globSpy).toHaveBeenCalledTimes(2);
    });
});
