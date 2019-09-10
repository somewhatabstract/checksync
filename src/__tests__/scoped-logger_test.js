// @flow
import Logger from "../logger.js";
import ScopedLogger from "../scoped-logger.js";

describe("ScopedLogger", () => {
    it("should return errorsLogged from underlying logger", () => {
        // Arrange
        const NullLogger = new Logger();
        const spy = jest.spyOn(NullLogger, "errorsLogged", "get");
        const logger = new ScopedLogger("SCOPE", NullLogger);

        // Act
        NullLogger.error("ERROR!");
        const result = logger.errorsLogged;

        // Assert
        expect(result).toBeTrue();
        expect(spy).toHaveBeenCalled();
    });

    it.each(["groupEnd", "group", "log", "error", "warn", "info"])(
        "should pass through call %s to logger",
        testCase => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, testCase);
            const logger = new ScopedLogger("SCOPE", NullLogger);

            // Act
            (logger: any)[testCase]("TEST_MESSAGE");

            // Assert
            expect(spy).toHaveBeenCalledWith("TEST_MESSAGE");
        },
    );

    it.each(["group", "log", "error", "warn", "info"])(
        "should start scoped group if first call to logger of %s",
        testCase => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "group");
            const logger = new ScopedLogger("SCOPE", NullLogger);

            // Act
            (logger: any)[testCase]("TEST_MESSAGE");

            // Assert
            expect(spy).toHaveBeenCalledWith("SCOPE");
        },
    );

    it.each(["group", "log", "error", "warn", "info"])(
        "should not start scoped group on secondary calls to %s",
        testCase => {
            // Arrange
            const NullLogger = new Logger();
            const logger = new ScopedLogger("SCOPE", NullLogger);
            (logger: any)[testCase]("TEST_MESSAGE");
            const spy = jest.spyOn(NullLogger, "group");

            // Act
            (logger: any)[testCase]("TEST_MESSAGE");

            // Assert
            expect(spy).not.toHaveBeenCalledWith("SCOPE");
        },
    );

    describe("#closeScope", () => {
        it("should end the group if it is open", () => {
            // Arrange
            const NullLogger = new Logger();
            const logger = new ScopedLogger("SCOPE", NullLogger);
            const spy = jest.spyOn(NullLogger, "groupEnd");
            logger.log("TEST_MESSAGE");

            // Act
            logger.closeScope();

            // Assert
            expect(spy).toHaveBeenCalled();
        });

        it("should should not end the group if it was not started", () => {
            // Arrange
            const NullLogger = new Logger();
            const logger = new ScopedLogger("SCOPE", NullLogger);
            const spy = jest.spyOn(NullLogger, "groupEnd");

            // Act
            logger.closeScope();

            // Assert
            expect(spy).not.toHaveBeenCalled();
        });
    });
});
