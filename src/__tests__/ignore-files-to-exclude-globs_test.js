// @flow
import * as FS from "fs";
import * as ParseGitIgnore from "parse-gitignore";
import defaultArgs from "../default-args.js";
import ignoreFilesToExcludeGlobs from "../ignore-files-to-exclude-globs.js";

jest.mock("fs");
jest.mock("parse-gitignore");

describe("#ignoreFilesToExcludeGlobs", () => {
    it("should return an empty array if the ignore files only include the defaults", () => {
        // Arrange
        jest.spyOn(FS, "existsSync").mockReturnValueOnce(false);

        // Act
        const result = ignoreFilesToExcludeGlobs(
            defaultArgs.ignoreFiles.split(","),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should create exclude globs from given ignore files", () => {
        // Arrange
        jest.spyOn(ParseGitIgnore, "default")
            .mockReturnValueOnce(["IGNORE1", "IGNORE2"])
            .mockReturnValueOnce(["IGNORE1", "IGNORE3"]);

        // Act
        const result = ignoreFilesToExcludeGlobs(["ignore12", "ignore13"]);

        // Assert
        expect(result).toStrictEqual([
            "**/IGNORE1/**",
            "IGNORE1",
            "**/IGNORE2/**",
            "IGNORE2",
            "**/IGNORE3/**",
            "IGNORE3",
        ]);
    });
});
