// @flow
import * as GetFiles from "../get-files.js";
import * as GetMarkersFromFiles from "../get-markers-from-files.js";
import Logger from "../logging.js";

import checkSync from "../check-sync.js";

jest.mock("../get-files.js");
jest.mock("../get-markers-from-files.js");

const NullLogger = new Logger();

describe("#checkSync", () => {
    it("should expand the globs to files", async () => {
        // Arrange
        const getFilesSpy = jest.spyOn(GetFiles, "default").mockReturnValue([]);

        // Act
        await checkSync(["glob1", "glob2"], true, ["//"], NullLogger);

        // Assert
        expect(getFilesSpy).toHaveBeenCalledWith(["glob1", "glob2"]);
    });

    it("should log an error when there are no matching files", async () => {
        // Arrange
        jest.spyOn(GetFiles, "default").mockReturnValue([]);
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        await checkSync(["glob1", "glob2"], false, ["//"], NullLogger);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith("No matching files");
    });

    it("should build a marker cache from the files", async () => {
        // Arrange
        jest.spyOn(GetFiles, "default").mockReturnValue(["filea", "fileb"]);
        const getMarkersFromFilesSpy = jest
            .spyOn(GetMarkersFromFiles, "default")
            .mockReturnValue({});

        // Act
        await checkSync([], true, ["//"], NullLogger);

        // Assert
        expect(getMarkersFromFilesSpy).toHaveBeenCalledWith(
            ["filea", "fileb"],
            ["//"],
            NullLogger,
        );
    });

    it.todo("should indicate there were errors during parsing");
    it.todo("should log sync errors when they exist");
    it.todo("should log success when all markers are correct");
});
