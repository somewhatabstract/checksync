// @flow
import fs from "fs";
import path from "path";
import * as ParseGitIgnore from "parse-gitignore";
import defaultArgs from "../default-args.js";
import ignoreFilesToExcludeGlobs from "../ignore-files-to-exclude-globs.js";

jest.mock("fs");
jest.mock("parse-gitignore");

describe("#ignoreFilesToExcludeGlobs", () => {
    it("should return an empty array if the ignore files only include the defaults", async () => {
        // Arrange
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);

        // Act
        const result = await ignoreFilesToExcludeGlobs(
            defaultArgs.ignoreFiles.split(","),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should create exclude globs from given ignore files, rooted to the ignore file path", async () => {
        // Arrange
        jest.spyOn(fs, "readFile").mockImplementation((file, callback) => {
            callback();
        });
        jest.spyOn(ParseGitIgnore, "default")
            .mockReturnValueOnce(["IGNORE1", "IGNORE2"])
            .mockReturnValueOnce(["IGNORE1", "IGNORE3"]);
        jest.spyOn(path, "dirname").mockImplementation(
            (inputPath) => `${path.basename(inputPath)}dir`,
        );

        // Act
        const result = await ignoreFilesToExcludeGlobs([
            "ignore12",
            "ignore13",
        ]);

        // Assert
        expect(result).toStrictEqual([
            "ignore12dir/**/IGNORE1/**",
            "ignore12dir/IGNORE1",
            "ignore12dir/**/IGNORE2/**",
            "ignore12dir/IGNORE2",
            "ignore13dir/**/IGNORE1/**",
            "ignore13dir/IGNORE1",
            "ignore13dir/**/IGNORE3/**",
            "ignore13dir/IGNORE3",
        ]);
    });
});
