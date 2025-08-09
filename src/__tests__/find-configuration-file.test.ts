import * as Ancesdir from "ancesdir";
import * as FS from "fs";
import path from "path";
import normalizeSeparators from "../normalize-separators";

import Logger from "../logger";
import findConfigurationFile, {
    checkSyncRcNames,
} from "../find-configuration-file";

jest.mock("fs");
jest.mock("ancesdir");

describe("#findConfigurationFile", () => {
    it("should look relative to the root based on the current directory", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(process, "cwd").mockReturnValue("/");
        const ancesdirSpy = jest
            .spyOn(Ancesdir, "closesdir")
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
            jest.spyOn(Ancesdir, "closesdir").mockReturnValue("/");

            // Act
            await findConfigurationFile("root", NullLogger);

            // Assert
            expect(existsSpy).toHaveBeenCalledWith(`${path.sep}${configFile}`);
        },
    );

    it("should return a root-relative configuration file if one exists", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(process, "cwd").mockReturnValue("/");
        jest.spyOn(FS, "existsSync").mockReturnValue(true);
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("/");

        // Act
        const result = normalizeSeparators(
            (await findConfigurationFile("root", NullLogger)) || "",
        );

        // Assert
        expect(result).toBe("/.checksyncrc");
    });

    describe("when no root-relative configuration exists", () => {
        it("should return the configuration that is closest to the current working directory", async () => {
            // Arrange
            const NullLogger = new Logger(null, true);
            jest.spyOn(process, "cwd").mockReturnValue("/gramps/parent/cwd");
            jest.spyOn(Ancesdir, "closesdir")
                .mockImplementationOnce(() => {
                    throw new Error(
                        "First call is the root marker search, and we want that to fail in this test case",
                    );
                })
                .mockReturnValueOnce("/gramps") // .checksyncrc
                .mockReturnValueOnce("/gramps/parent/cwd"); //.checksyncrc.json

            // Act
            const result = normalizeSeparators(
                (await findConfigurationFile("root", NullLogger)) || "",
            );

            // Assert
            expect(result).toBe("/gramps/parent/cwd/.checksyncrc.json");
        });

        it("should return null if there is no configuration found", async () => {
            // Arrange
            const NullLogger = new Logger(null, true);
            jest.spyOn(process, "cwd").mockReturnValue("/gramps/parent/cwd");
            jest.spyOn(Ancesdir, "closesdir").mockImplementation(() => {
                throw new Error("We never want this to find anything");
            });

            // Act
            const result = await findConfigurationFile("root", NullLogger);

            // Assert
            expect(result).toBeNull();
        });
    });
});
