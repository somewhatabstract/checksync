// @flow

import {ConsoleLogger} from "../logging.js";
import Format from "../format.js";

jest.mock("../format.js");

describe("ConsoleLogger", () => {
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

        it("should format as info", () => {
            // Arrange
            jest.spyOn(console, "info").mockImplementation(() => {});
            const formatSpy = jest.spyOn(Format, "info");

            // Act
            ConsoleLogger.info("Test");

            // Assert
            expect(formatSpy).toHaveBeenCalledWith("Test");
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

        it("should format as error", () => {
            // Arrange
            jest.spyOn(console, "error").mockImplementation(() => {});
            const formatSpy = jest.spyOn(Format, "error");

            // Act
            ConsoleLogger.error("Test");

            // Assert
            expect(formatSpy).toHaveBeenCalledWith("Test");
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

        it("should format as warn", () => {
            // Arrange
            jest.spyOn(console, "warn").mockImplementation(() => {});
            const formatSpy = jest.spyOn(Format, "warn");

            // Act
            ConsoleLogger.warn("Test");

            // Assert
            expect(formatSpy).toHaveBeenCalledWith("Test");
        });
    });
});
