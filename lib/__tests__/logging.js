// @flow
import chalk from "chalk";

import {ConsoleLogger} from "../logging.js";

describe("ConsoleLogger", () => {
    beforeEach(() => {
        chalk.enabled = false;
    });

    afterEach(() => {
        chalk.enabled = true;
    });

    describe("#log", () => {
        it("should call console.log", () => {
            // Arrange
            const logSpy = jest
                .spyOn(console, "log")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.log("Test");

            // Assert
            expect(logSpy).toHaveBeenCalled();
        });
    });

    describe("#info", () => {
        it("should call console.info", () => {
            // Arrange
            const infoSpy = jest
                .spyOn(console, "info")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.info("Test");

            // Assert
            expect(infoSpy).toHaveBeenCalled();
        });

        it("should prefix with _INFO__", () => {
            // Arrange
            const infoSpy = jest
                .spyOn(console, "info")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.info("Test");

            // Assert
            expect(infoSpy).toHaveBeenCalledWith(
                expect.stringMatching(" INFO  Test"),
            );
        });
    });

    describe("#error", () => {
        it("should call console.error", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.error("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should prefix with _ERROR__", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.error("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringMatching(" ERROR  Test"),
            );
        });
    });

    describe("#warn", () => {
        it("should call console.warn", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.warn("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should prefix with _WARNING__", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            // Act
            ConsoleLogger.warn("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringMatching(" WARNING  Test"),
            );
        });
    });
});
