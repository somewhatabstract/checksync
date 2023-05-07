import fs from "fs";
import path from "path";
import * as ParseGitIgnore from "parse-gitignore";
import ignoreFileToExcludeGlobs from "../ignore-file-to-exclude-globs";

jest.mock("fs");
jest.mock("parse-gitignore");

describe("#ignoreFileToExcludeGlobs", () => {
    it("should create exclude globs from given ignore file, rooted to the ignore file path", async () => {
        // Arrange
        jest.spyOn(fs, "readFile").mockImplementation((file, callback) => {
            // We don't actually care here as we're going to override the
            // return of parseGitIgnore instead of actually parsing a file's
            // contents.
            callback(null, Buffer.from(""));
        });
        jest.spyOn(ParseGitIgnore, "default").mockReturnValueOnce([
            "IGNORE1",
            "IGNORE2",
        ]);
        jest.spyOn(path, "dirname").mockImplementation(
            // This just makes us have a path name for the dir of the file
            // being processed.
            (inputPath) => `${path.basename(inputPath)}dir`,
        );

        // Act
        const result = await ignoreFileToExcludeGlobs("ignore12");

        // Assert
        expect(result).toStrictEqual([
            "ignore12dir/**/IGNORE1/**",
            "ignore12dir/IGNORE1",
            "ignore12dir/**/IGNORE2/**",
            "ignore12dir/IGNORE2",
        ]);
    });
});
