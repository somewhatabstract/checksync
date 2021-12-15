// @flow
import Logger from "../logger.js";
import FileReferenceLogger from "../file-reference-logger.js";

describe("FileReferenceLogger", () => {
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

    describe("#file", () => {
        it("should return file path", () => {
            // Arrange
            const NullLogger = new Logger();
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            const result = logger.file;

            // Assert
            expect(result).toBe("FILE");
        });
    });

    describe("#verbose", () => {
        it("should prefix with default file reference", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "verbose");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            logger.verbose(() => "MESSAGE");

            // Assert
            expect(spy).toHaveBeenCalledWith(expect.any(Function));
            expect(spy.mock.calls[0][0]()).toBe("FILE MESSAGE");
        });

        it("should prefix with file:line reference", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "verbose");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            logger.verbose(() => "MESSAGE", 42);

            // Assert
            expect(spy).toHaveBeenCalledWith(expect.any(Function));
            expect(spy.mock.calls[0][0]()).toBe("FILE:42 MESSAGE");
        });

        it("should pass nullish if the message resolves to nullish", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "verbose");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            logger.verbose(() => null, 42);

            // Assert
            expect(spy).toHaveBeenCalledWith(expect.any(Function));
            expect(spy.mock.calls[0][0]()).toBeNull();
        });
    });

    describe.each(["mismatch", "fix"])("#%s", (testCase) => {
        it("should prefix with default file reference and message type", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "log");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            (logger: any)[testCase]("MESSAGE");

            // Assert
            expect(spy).toHaveBeenCalledWith(
                ` ${testCase.toUpperCase()}  FILE MESSAGE`,
            );
        });

        it("should prefix with file:line reference", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "log");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            (logger: any)[testCase]("MESSAGE", 42);

            // Assert
            expect(spy).toHaveBeenCalledWith(
                ` ${testCase.toUpperCase()}  FILE:42 MESSAGE`,
            );
        });
    });

    describe.each(["error", "log", "warn", "info"])("#%s", (testCase) => {
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
