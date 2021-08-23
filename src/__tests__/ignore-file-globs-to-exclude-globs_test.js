// @flow
import fs from "fs";
import * as FastGlob from "fast-glob";
import * as IgnoreFileToExcludeGlobs from "../ignore-file-to-exclude-globs.js";
import defaultArgs from "../default-args.js";
import ignoreFileGlobsToExcludeGlobs from "../ignore-file-globs-to-exclude-globs.js";

jest.mock("fs");
jest.mock("fast-glob");

describe("#ignoreFileGlobsToExcludeGlobs", () => {
    it("should return an empty array if the ignore files only include the defaults", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);

        // Act
        const result = await ignoreFileGlobsToExcludeGlobs(
            defaultArgs.ignoreFiles.split(","),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should resolve the file globs to files", async () => {
        // Arrange
        const fgSpy = jest.spyOn(FastGlob, "default").mockReturnValue([]);

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
        jest.spyOn(FastGlob, "default").mockReturnValue([
            "ignorefile12",
            "ignorefile13",
        ]);
        jest.spyOn(IgnoreFileToExcludeGlobs, "default")
            .mockReturnValueOnce(["IGNORE1", "IGNORE2"])
            .mockReturnValueOnce(["IGNORE1", "IGNORE3"]);

        // Act
        const result = await ignoreFileGlobsToExcludeGlobs([
            "ignore12",
            "ignore13",
        ]);

        // Assert
        expect(result).toStrictEqual(["IGNORE1", "IGNORE2", "IGNORE3"]);
    });
});
