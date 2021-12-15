// @flow
import {runCli, checkSync, loadConfigurationFile} from "../main.js";

import * as Cli from "../cli.js";
import * as CheckSync from "../check-sync.js";
import * as LoadConfigurationFile from "../load-configuration-file";

describe("main.js", () => {
    describe("#runCli", () => {
        it("should run the CLI", () => {
            // Arrange
            jest.spyOn(Cli, "run").mockImplementation(() => {});

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
                .mockImplementation(() => {});
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
                .mockImplementation(() => {});
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
