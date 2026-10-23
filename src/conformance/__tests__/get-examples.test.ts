import fs from "fs";

import getExamples from "../get-examples";

jest.mock("fs");

describe("#getExamples", () => {
    it("should read the given examples directory", () => {
        // Arrange
        const readdirSyncSpy = jest
            .spyOn(fs, "readdirSync")
            .mockReturnValue([]);

        // Act
        getExamples("/repo/__examples__");

        // Assert
        expect(readdirSyncSpy).toHaveBeenCalledWith("/repo/__examples__");
    });

    it("should only return directories since each example is a directory", () => {
        // Arrange
        jest.spyOn(fs, "readdirSync").mockReturnValue([
            "a_file",
            "b_dir",
        ] as any);
        jest.spyOn(fs, "lstatSync").mockImplementation(
            (p) =>
                ({
                    isDirectory: () => String(p).endsWith("dir"),
                }) as any,
        );

        // Act
        const result = getExamples("/repo/__examples__");

        // Assert
        expect(result).toEqual(["b_dir"]);
    });

    it("should sort the examples so cases run in a stable order", () => {
        // Arrange
        jest.spyOn(fs, "readdirSync").mockReturnValue(["b", "a"] as any);
        jest.spyOn(fs, "lstatSync").mockReturnValue({
            isDirectory: () => true,
        } as any);

        // Act
        const result = getExamples("/repo/__examples__");

        // Assert
        expect(result).toEqual(["a", "b"]);
    });
});
