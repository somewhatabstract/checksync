// @flow
import * as AncesdirOrCurrentDir from "../ancesdir-or-currentdir.js";
import * as FS from "fs";

import Logger from "../logger.js";
import findConfigurationFile, {
    checkSyncRcNames,
} from "../find-configuration-file.js";

jest.mock("fs");
jest.mock("../ancesdir-or-currentdir.js");

describe("#findConfigurationFile", () => {
    it("should look relative to the root based on the current directory", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(process, "cwd").mockReturnValue("/");
        const ancesdirSpy = jest
            .spyOn(AncesdirOrCurrentDir, "ancesdirOrCurrentDir")
            .mockReturnValue("/");

        // Act
        await findConfigurationFile("root", NullLogger);

        // Assert
        expect(ancesdirSpy).toHaveBeenCalledWith("/", "root");
    });

    it.each(checkSyncRcNames)(
        "should look for known configuration %s at root",
        async (configFile) => {
            // Arrange
            const NullLogger = new Logger(null, true);
            jest.spyOn(process, "cwd").mockReturnValue("/");
            const existsSpy = jest.spyOn(FS, "existsSync");
            jest.spyOn(
                AncesdirOrCurrentDir,
                "ancesdirOrCurrentDir",
            ).mockReturnValue("/");

            // Act
            await findConfigurationFile("root", NullLogger);

            // Assert
            expect(existsSpy).toHaveBeenCalledWith(`/${configFile}`);
        },
    );

    it("should return a root-relative configuration file if one exists", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(process, "cwd").mockReturnValue("/");
        jest.spyOn(FS, "existsSync").mockReturnValue(true);
        jest.spyOn(
            AncesdirOrCurrentDir,
            "ancesdirOrCurrentDir",
        ).mockReturnValue("/");

        // Act
        const result = await findConfigurationFile("root", NullLogger);

        // Assert
        expect(result).toBe("/.checksyncrc");
    });

    describe("when no root-relative configuration exists", () => {
        it("should return the configuration that is closest to the current working directory", async () => {
            // Arrange
            const NullLogger = new Logger(null, true);
            jest.spyOn(process, "cwd").mockReturnValue("/gramps/parent/cwd");
            jest.spyOn(AncesdirOrCurrentDir, "ancesdirOrCurrentDir")
                .mockImplementationOnce(() => {
                    throw new Error(
                        "First call is the root marker search, and we want that to fail in this test case",
                    );
                })
                .mockReturnValueOnce("/gramps") // .checksyncrc
                .mockReturnValueOnce("/gramps/parent/cwd"); //.checksyncrc.json

            // Act
            const result = await findConfigurationFile("root", NullLogger);

            // Assert
            expect(result).toBe("/gramps/parent/cwd/.checksyncrc.json");
        });

        it("should return null if there is no configuration found", async () => {
            // Arrange
            const NullLogger = new Logger(null, true);
            jest.spyOn(process, "cwd").mockReturnValue("/gramps/parent/cwd");
            jest.spyOn(
                AncesdirOrCurrentDir,
                "ancesdirOrCurrentDir",
            ).mockImplementation(() => {
                throw new Error("We never want this to find anything");
            });

            // Act
            const result = await findConfigurationFile("root", NullLogger);

            // Assert
            expect(result).toBeNull();
        });
    });
});
