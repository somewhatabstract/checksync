import path from "path";
import defaultIncludeGlobs from "../default-include-globs";

describe("defaultIncludeGlobs", () => {
    it("should match everything when the start folder is the working directory", () => {
        // Arrange
        const startDir = process.cwd();

        // Act
        const result = defaultIncludeGlobs(startDir);

        // Assert
        expect(result).toStrictEqual(["**"]);
    });

    it("should match everything below the start folder when it is below the working directory", () => {
        // Arrange
        const startDir = path.join(process.cwd(), "a", "b");

        // Act
        const result = defaultIncludeGlobs(startDir);

        // Assert
        expect(result).toStrictEqual(["a/b/**"]);
    });

    it("should escape glob characters in the start folder's path", () => {
        // Arrange
        const startDir = path.join(process.cwd(), "[a]");

        // Act
        const result = defaultIncludeGlobs(startDir);

        // Assert
        expect(result).toStrictEqual(["\\[a\\]/**"]);
    });

    it("should match everything below the working directory when the start folder is above it", () => {
        // Arrange
        const startDir = path.dirname(process.cwd());

        // Act
        const result = defaultIncludeGlobs(startDir);

        // Assert
        expect(result).toStrictEqual(["**"]);
    });

    it("should match everything below the working directory when the start folder is beside it", () => {
        // Arrange
        const startDir = path.join(path.dirname(process.cwd()), "elsewhere");

        // Act
        const result = defaultIncludeGlobs(startDir);

        // Assert
        expect(result).toStrictEqual(["**"]);
    });

    it("should match below a start folder whose name begins with two periods", () => {
        // Arrange
        const startDir = path.join(process.cwd(), "..a");

        // Act
        const result = defaultIncludeGlobs(startDir);

        // Assert
        expect(result).toStrictEqual(["..a/**"]);
    });
});
