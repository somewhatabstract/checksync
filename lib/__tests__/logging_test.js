// @flow

import Logger from "../logging.js";
import Format from "../format.js";

const NullLogger = new Logger();

jest.mock("../format.js");

describe("Logger", () => {
    describe("#group", () => {
        it("should call group", () => {
            // Arrange
            const logSpy = jest
                .spyOn(NullLogger, "group")
                .mockImplementation(() => {});
            const logger = new Logger(NullLogger);

            // Act
            logger.group("Test", "This", "Out");

            // Assert
            expect(logSpy).toHaveBeenCalledWith("Test", "This", "Out");
        });
    });

    describe("#groupEnd", () => {
        it("should call groupEnd", () => {
            // Arrange
            const logSpy = jest
                .spyOn(NullLogger, "groupEnd")
                .mockImplementation(() => {});
            const logger = new Logger(NullLogger);

            // Act
            logger.groupEnd();

            // Assert
            expect(logSpy).toHaveBeenCalled();
        });
    });

    describe("#log", () => {
        it("should call log", () => {
            // Arrange
            const logSpy = jest
                .spyOn(NullLogger, "log")
                .mockImplementation(() => {});
            const logger = new Logger(NullLogger);

            // Act
            logger.log("Test");

            // Assert
            expect(logSpy).toHaveBeenCalledWith("Test");
        });
    });

    describe("#info", () => {
        it("should call console.info", () => {
            // Arrange
            const infoSpy = jest
                .spyOn(NullLogger, "info")
                .mockImplementation(() => {});
            const logger = new Logger(NullLogger);

            // Act
            logger.info("Test");

            // Assert
            expect(infoSpy).toHaveBeenCalled();
        });

        it("should format as info", () => {
            // Arrange
            jest.spyOn(NullLogger, "info").mockImplementation(() => {});
            const formatSpy = jest.spyOn(Format, "info");
            const logger = new Logger(NullLogger);

            // Act
            logger.info("Test");

            // Assert
            expect(formatSpy).toHaveBeenCalledWith("Test");
        });
    });

    describe("#error", () => {
        it("should call console.error", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(NullLogger, "error")
                .mockImplementation(() => {});
            const logger = new Logger(NullLogger);

            // Act
            logger.error("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should format as error", () => {
            // Arrange
            jest.spyOn(NullLogger, "error").mockImplementation(() => {});
            const formatSpy = jest.spyOn(Format, "error");
            const logger = new Logger(NullLogger);

            // Act
            logger.error("Test");

            // Assert
            expect(formatSpy).toHaveBeenCalledWith("Test");
        });
    });

    describe("#warn", () => {
        it("should call console.warn", () => {
            // Arrange
            const errorSpy = jest
                .spyOn(NullLogger, "warn")
                .mockImplementation(() => {});
            const logger = new Logger(NullLogger);

            // Act
            logger.warn("Test");

            // Assert
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should format as warn", () => {
            // Arrange
            jest.spyOn(NullLogger, "warn").mockImplementation(() => {});
            const formatSpy = jest.spyOn(Format, "warn");
            const logger = new Logger(NullLogger);

            // Act
            logger.warn("Test");

            // Assert
            expect(formatSpy).toHaveBeenCalledWith("Test");
        });
    });
});
