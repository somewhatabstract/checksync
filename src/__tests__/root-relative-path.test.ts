import fs from "fs";
import path from "path";

import * as ClosestRootDir from "../closest-root-dir";

import rootRelativePath from "../root-relative-path";

jest.mock("../closest-root-dir");
jest.mock("path");
jest.mock("fs");

describe("rootRelativePath", () => {
    it("should look for the root path from the folder containing the file", () => {
        // Arrange
        const closestRootDirSpy = jest
            .spyOn(ClosestRootDir, "default")
            .mockReturnValue("ROOT");
        jest.spyOn(path, "isAbsolute").mockReturnValue(true);
        jest.spyOn(path, "dirname").mockReturnValue("DIR");

        // Act
        rootRelativePath("FILE", "MARKER");

        // Assert
        expect(closestRootDirSpy).toHaveBeenCalledWith("DIR", "MARKER");
    });

    it("should get relative path from root to given file", () => {
        // Arrange
        jest.spyOn(ClosestRootDir, "default").mockReturnValue("ROOT");
        const pathSpy = jest
            .spyOn(path, "relative")
            .mockReturnValue("RELATIVE_PATH");
        jest.spyOn(path, "isAbsolute").mockReturnValue(true);

        // Act
        const result = rootRelativePath("FILE");

        // Assert
        expect(result).toBe("RELATIVE_PATH");
        expect(pathSpy).toHaveBeenCalledWith("ROOT", "FILE");
    });

    it("should get original file path if it isn't absolute", () => {
        // Arrange
        jest.spyOn(path, "isAbsolute").mockReturnValue(false);

        // Act
        const result = rootRelativePath("FILE");

        // Assert
        expect(result).toBe("FILE");
    });

    it("should use the path itself as the root when it contains the marker", () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(path, "isAbsolute").mockReturnValue(true);
        jest.spyOn(path, "relative").mockImplementation(
            (from, to) => `${from} -> ${to}`,
        );

        // Act
        const result = rootRelativePath("DIR", "MARKER");

        // Assert
        expect(result).toBe("DIR -> DIR");
    });

    it("should check the path itself for the given marker", () => {
        // Arrange
        jest.spyOn(ClosestRootDir, "default").mockReturnValue("ROOT");
        jest.spyOn(path, "isAbsolute").mockReturnValue(true);
        const joinSpy = jest.spyOn(path, "join");

        // Act
        rootRelativePath("DIR", "MARKER");

        // Assert
        expect(joinSpy).toHaveBeenCalledWith("DIR", "MARKER");
    });

    it("should check the path itself for ancesdir's default marker when no marker is given", () => {
        // Arrange
        jest.spyOn(ClosestRootDir, "default").mockReturnValue("ROOT");
        jest.spyOn(path, "isAbsolute").mockReturnValue(true);
        const joinSpy = jest.spyOn(path, "join");

        // Act
        rootRelativePath("DIR");

        // Assert
        expect(joinSpy).toHaveBeenCalledWith("DIR", "package.json");
    });
});
