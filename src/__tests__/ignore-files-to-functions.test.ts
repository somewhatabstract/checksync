import * as IgnoreFileToFunction from "../ignore-file-to-function";
import Logger from "../logger";

import ignoreFilesToFunctions from "../ignore-files-to-functions";

jest.mock("../ignore-file-to-function");

describe("ignoreFilesToFunctions", () => {
    it("should only create a predicate for a given gitignore file once", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const ignoreFileToAllowPredicateSpy = jest.spyOn(
            IgnoreFileToFunction,
            "default",
        );

        // Act
        await ignoreFilesToFunctions(
            ["/foo/.gitignore", "/foo/.gitignore"],
            NullLogger,
        );

        // Assert
        expect(ignoreFileToAllowPredicateSpy).toHaveBeenCalledTimes(1);
    });

    it("should return one predicate per deduplicated file path", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(IgnoreFileToFunction, "default").mockResolvedValue(
            jest.fn(),
        );

        // Act
        const result = await ignoreFilesToFunctions(
            ["/foo/.gitignore", "/bar/.gitignore", "/foo/.gitignore"],
            NullLogger,
        );

        // Assert
        expect(result).toHaveLength(2);
    });
});
