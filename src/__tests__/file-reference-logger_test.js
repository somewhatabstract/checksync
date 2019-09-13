// @flow
import chalk from "chalk";
import Logger from "../logger.js";
import FileReferenceLogger from "../file-reference-logger.js";

describe("FileReferenceLogger", () => {
    beforeEach(() => {
        chalk.enabled = false;
    });

    afterEach(() => {
        chalk.enabled = true;
    });

    it("should return errorsLogged from underlying logger", () => {
        // Arrange
        const NullLogger = new Logger();
        const spy = jest.spyOn(NullLogger, "errorsLogged", "get");
        const logger = new FileReferenceLogger("FILE", NullLogger);

        // Act
        NullLogger.error("ERROR!");
        const result = logger.errorsLogged;

        // Assert
        expect(result).toBeTrue();
        expect(spy).toHaveBeenCalled();
    });

    it("should pass group through to underlying logger", () => {
        // Arrange
        const NullLogger = new Logger();
        const spy = jest.spyOn(NullLogger, "group");
        const logger = new FileReferenceLogger("FILE", NullLogger);

        // Act
        logger.group("TEST_MESSAGE");

        // Assert
        expect(spy).toHaveBeenCalledWith("TEST_MESSAGE");
    });

    it("should pass groupEnd through to underlying logger", () => {
        // Arrange
        const NullLogger = new Logger();
        const spy = jest.spyOn(NullLogger, "groupEnd");
        const logger = new FileReferenceLogger("FILE", NullLogger);

        // Act
        logger.groupEnd();

        // Assert
        expect(spy).toHaveBeenCalled();
    });

    describe.each(["error", "log", "warn", "info"])("#%s", testCase => {
        it("should prefix with default file reference", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, testCase);
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            (logger: any)[testCase]("MESSAGE");

            // Assert
            expect(spy).toHaveBeenCalledWith("FILE MESSAGE");
        });

        it("should prefix with file:line reference", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, testCase);
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            (logger: any)[testCase]("MESSAGE", 42);

            // Assert
            expect(spy).toHaveBeenCalledWith("FILE:42 MESSAGE");
        });
    });
});
