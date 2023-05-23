import fs from "fs";
import * as FastGlob from "fast-glob";
import * as IgnoreFileToExcludeGlobs from "../ignore-file-to-exclude-globs";
import defaultOptions from "../default-options";
import ignoreFileGlobsToExcludeGlobs from "../ignore-file-globs-to-exclude-globs";

jest.mock("fs");
jest.mock("fast-glob");

describe("#ignoreFileGlobsToExcludeGlobs", () => {
    it("should return an empty array if the ignore files only include the defaults", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);

        // Act
        const result = await ignoreFileGlobsToExcludeGlobs(
            defaultOptions.ignoreFiles,
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should resolve the file globs to files", async () => {
        // Arrange
        const fgSpy = jest.spyOn(FastGlob, "default").mockResolvedValue([]);

        // Act
        await ignoreFileGlobsToExcludeGlobs(["file1", "file2"]);

        // Assert
        expect(fgSpy).toHaveBeenCalledWith(["file1", "file2"], {
            onlyFiles: true,
            absolute: true,
        });
    });

    it("should return an empty array if no files provided", async () => {
        // Arrange

        // Act
        const result = await ignoreFileGlobsToExcludeGlobs([]);

        // Assert
        expect(result).toBeEmpty();
    });

    it("should gather exclude globs from given ignore files", async () => {
        // Arrange
        jest.spyOn(FastGlob, "default").mockResolvedValue([
            "ignorefile12",
            "ignorefile13",
        ]);
        jest.spyOn(IgnoreFileToExcludeGlobs, "default")
            .mockResolvedValueOnce(["IGNORE1", "IGNORE2"])
            .mockResolvedValueOnce(["IGNORE1", "IGNORE3"]);

        // Act
        const result = await ignoreFileGlobsToExcludeGlobs([
            "ignore12",
            "ignore13",
        ]);

        // Assert
        expect(result).toStrictEqual(["IGNORE1", "IGNORE2", "IGNORE3"]);
    });
});