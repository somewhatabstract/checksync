// @flow
import path from "path";
import * as Ancesdir from "ancesdir";

import rootRelativePath from "../root-relative-path.js";

jest.mock("ancesdir");
jest.mock("path");

describe("rootRelativePath", () => {
    it("should get root path from ancesdir", () => {
        // Arrange
        const ancesdirSpy = jest
            .spyOn(Ancesdir, "default")
            .mockReturnValue("ROOT");

        // Act
        rootRelativePath("FILE", "MARKER");

        // Assert
        expect(ancesdirSpy).toHaveBeenCalledWith("FILE", "MARKER");
    });

    it("should get relative path from root to given file", () => {
        // Arrange
        jest.spyOn(Ancesdir, "default").mockReturnValue("ROOT");
        const pathSpy = jest
            .spyOn(path, "relative")
            .mockReturnValue("RELATIVE_PATH");

        // Act
        const result = rootRelativePath("FILE");

        // Assert
        expect(result).toBe("RELATIVE_PATH");
        expect(pathSpy).toHaveBeenCalledWith("ROOT", "FILE");
    });
});
