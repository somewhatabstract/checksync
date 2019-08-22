// @flow
import chalk from "chalk";

import logging from "../logging.js";

describe("logging.js", () => {
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
            logging.log("Test");

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
            logging.info("Test");

            // Assert
            expect(infoSpy).toHaveBeenCalled();
        });

        it("should prefix with _INFO__", () => {
            // Arrange
            const infoSpy = jest
                .spyOn(console, "info")
                .mockImplementation(() => {});

            // Act
            logging.info("Test");

            // Assert
            expect(infoSpy).toHaveBeenCalledWith(
                expect.stringMatching(" INFO  Test")
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
            logging.error("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should prefix with _ERROR__", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Act
            logging.error("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringMatching(" ERROR  Test")
            );
        });
    });
});
