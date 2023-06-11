import Logger from "../logger";
import {ExitCode} from "../exit-codes";
import setCwd from "../set-cwd";

import * as Exit from "../exit";

jest.mock("../exit");

describe("setCwd", () => {
    it("should set the current working directory", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const chdirSpy = jest.spyOn(process, "chdir");

        // Act
        setCwd(NullLogger, "some/path");

        // Assert
        expect(chdirSpy).toHaveBeenCalledWith("some/path");
    });

    it("should exit with ExitCode.CATASTROPHIC if cwd arg present and chdir fails", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const exitSpy = jest.spyOn(Exit, "default");
        jest.spyOn(process, "chdir").mockImplementationOnce(() => {
            throw new Error("PRETEND CHDIR FAIL!");
        });

        // Act
        setCwd(NullLogger, "some/path");

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(
            expect.anything(),
            ExitCode.CATASTROPHIC,
        );
    });
});
