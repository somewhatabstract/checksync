import path from "path";

import * as AncesdirOrCurrentDir from "../ancesdir-or-currentdir";

import rootRelativePath from "../root-relative-path";

jest.mock("../ancesdir-or-currentdir");
jest.mock("path");

describe("rootRelativePath", () => {
    it("should get root path from ancesdir", () => {
        // Arrange
        const ancesdirSpy = jest
            .spyOn(AncesdirOrCurrentDir, "ancesdirOrCurrentDir")
            .mockReturnValue("ROOT");
        jest.spyOn(path, "isAbsolute").mockReturnValue(true);

        // Act
        rootRelativePath("FILE", "MARKER");

        // Assert
        expect(ancesdirSpy).toHaveBeenCalledWith("FILE", "MARKER");
    });

    it("should get relative path from root to given file", () => {
        // Arrange
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("ROOT");
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
});
