import {runCli, checkSync, loadConfigurationFile} from "../main";

import * as Cli from "../cli";
import * as CheckSync from "../check-sync";
import * as LoadConfigurationFile from "../load-configuration-file";
import {ExitCode} from "../exit-codes";

describe("main.js", () => {
    describe("#runCli", () => {
        it("should run the CLI", () => {
            // Arrange
            jest.spyOn(Cli, "run").mockImplementation(() => Promise.resolve());

            // Act
            runCli("LAUNCH_FILE_PATH");

            // Assert
            expect(Cli.run).toHaveBeenCalledWith("LAUNCH_FILE_PATH");
        });
    });

    describe("#checkSync", () => {
        it("should run checksync", () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(CheckSync, "default")
                .mockImplementation(() => Promise.resolve(ExitCode.SUCCESS));
            const logger: any = {
                fake: "logger",
            };
            const options: any = {
                these_are: "options",
            };

            // Act
            checkSync(options, logger);

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(options, logger);
        });
    });

    describe("#loadConfigurationFile", () => {
        it("should load the configuration file", () => {
            // Arrange
            const loadConfigurationFileSpy = jest
                .spyOn(LoadConfigurationFile, "default")
                .mockImplementation(() => Promise.resolve(undefined));
            const logger: any = {
                fake: "logger",
            };

            // Act
            loadConfigurationFile("LAUNCH_FILE_PATH", logger);

            // Assert
            expect(loadConfigurationFileSpy).toHaveBeenCalledWith(
                "LAUNCH_FILE_PATH",
                logger,
            );
        });
    });
});
