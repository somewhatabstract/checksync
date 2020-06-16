// @flow
import fs from "fs";
import path from "path";

import getNormalizedTargetFileInfo from "../get-normalized-target-file-info.js";

jest.mock("fs");
jest.mock("path");

describe("#getNormalizedTargetFileInfo", () => {
    it("should get the normalize the path against the rootPath", () => {
        // Arrange
        jest.spyOn(path, "join").mockImplementation((...args) =>
            args.join("|"),
        );
        jest.spyOn(path, "normalize").mockImplementation(
            (s) => `normalized|${s}`,
        );
        jest.spyOn(fs, "existsSync").mockReturnValue(false);

        // Act
        const result = getNormalizedTargetFileInfo("root.path", "file.ref");

        // Assert
        expect(result.file).toBe("normalized|root.path|file.ref");
    });

    it("should set exists to false if the path does not exist", () => {
        // Arrange
        jest.spyOn(path, "join").mockImplementation((...args) => {
            const realPath = jest.requireActual("path");
            return realPath.join(...args);
        });
        jest.spyOn(path, "normalize").mockImplementation((s) => s);
        jest.spyOn(fs, "existsSync").mockReturnValue(false);

        // Act
        const result = getNormalizedTargetFileInfo("root.path", "file.ref");

        // Assert
        expect(result.exists).toBeFalse();
    });

    it("should set exists to false if the path exists but is not a file", () => {
        // Arrange
        jest.spyOn(path, "join").mockImplementation((...args) => {
            const realPath = jest.requireActual("path");
            return realPath.join(...args);
        });
        jest.spyOn(path, "normalize").mockImplementation((s) => s);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({
            isFile: () => false,
        });

        // Act
        const result = getNormalizedTargetFileInfo("root.path", "file.ref");

        // Assert
        expect(result.exists).toBeFalse();
    });

    it("should set exists to true if the path exists and it is a file", () => {
        // Arrange
        jest.spyOn(path, "join").mockImplementation((...args) => {
            const realPath = jest.requireActual("path");
            return realPath.join(...args);
        });
        jest.spyOn(path, "normalize").mockImplementation((s) => s);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "lstatSync").mockReturnValue({
            isFile: () => true,
        });

        // Act
        const result = getNormalizedTargetFileInfo("root.path", "file.ref");

        // Assert
        expect(result.exists).toBeTrue();
    });
});
