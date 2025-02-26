import fs from "fs";
import path from "path";

import getNormalizedPathInfo from "../get-normalized-path-info";

jest.mock("fs");
jest.mock("path");

describe("#getNormalizedRefInfo", () => {
    describe("when ref is a URL", () => {
        it("should set exists to true", () => {
            // Arrange

            // Act
            const result = getNormalizedPathInfo(
                "root.path",
                "http://example.com",
            );

            // Assert
            expect(result.exists).toBeTrue();
        });

        it("should set type to 'remote'", () => {
            // Arrange

            // Act
            const result = getNormalizedPathInfo(
                "root.path",
                "http://example.com",
            );

            // Assert
            expect(result.type).toBe("remote");
        });

        it("should not modify the path", () => {
            // Arrange

            // Act
            const result = getNormalizedPathInfo(
                "root.path",
                "http://example.com",
            );

            // Assert
            expect(result.path).toBe("http://example.com");
        });
    });

    describe("when ref is a file path", () => {
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
            const result = getNormalizedPathInfo("root.path", "file.ref");

            // Assert
            expect(result.path).toBe("normalized|root.path|file.ref");
        });

        it("should set exists to false if the path does not exist", () => {
            // Arrange
            jest.spyOn(path, "join").mockImplementation((...args) => {
                const realPath = jest.requireActual<typeof path>("path");
                return realPath.join(...args);
            });
            jest.spyOn(path, "normalize").mockImplementation((s) => s);
            jest.spyOn(fs, "existsSync").mockReturnValue(false);

            // Act
            const result = getNormalizedPathInfo("root.path", "file.ref");

            // Assert
            expect(result.exists).toBeFalse();
        });

        it("should set exists to false if the path exists but is not a file", () => {
            // Arrange
            jest.spyOn(path, "join").mockImplementation((...args) => {
                const realPath = jest.requireActual<typeof path>("path");
                return realPath.join(...args);
            });
            jest.spyOn(path, "normalize").mockImplementation((s) => s);
            jest.spyOn(fs, "existsSync").mockReturnValue(true);
            jest.spyOn(fs, "lstatSync").mockReturnValue({
                isFile: () => false,
            } as any);

            // Act
            const result = getNormalizedPathInfo("root.path", "file.ref");

            // Assert
            expect(result.exists).toBeFalse();
        });

        it("should set exists to true if the path exists and it is a file", () => {
            // Arrange
            jest.spyOn(path, "join").mockImplementation((...args) => {
                const realPath = jest.requireActual<typeof path>("path");
                return realPath.join(...args);
            });
            jest.spyOn(path, "normalize").mockImplementation((s) => s);
            jest.spyOn(fs, "existsSync").mockReturnValue(true);
            jest.spyOn(fs, "lstatSync").mockReturnValue({
                isFile: () => true,
            } as any);

            // Act
            const result = getNormalizedPathInfo("root.path", "file.ref");

            // Assert
            expect(result.exists).toBeTrue();
        });

        it("should set type to 'local'", () => {
            // Arrange
            jest.spyOn(path, "join").mockImplementation((...args) => {
                const realPath = jest.requireActual<typeof path>("path");
                return realPath.join(...args);
            });
            jest.spyOn(path, "normalize").mockImplementation((s) => s);
            jest.spyOn(fs, "existsSync").mockReturnValue(true);
            jest.spyOn(fs, "lstatSync").mockReturnValue({
                isFile: () => true,
            } as any);

            // Act
            const result = getNormalizedPathInfo("root.path", "file.ref");

            // Assert
            expect(result.type).toBe("local");
        });
    });
});
