import Logger from "../logger";
import {ILog} from "../types";
import FileReferenceLogger from "../file-reference-logger";

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
            expect(spy.mock.calls[0][0]()).toMatch(/FILE[\s\n]*MESSAGE/);
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
            expect(spy.mock.calls[0][0]()).toMatch(/FILE:42[\s\n]*MESSAGE/);
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

    describe.each(["Mismatch", "Fix", "Migrate"])("#%s", (testCase) => {
        it("should prefix with default file reference and message type", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "log");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            (logger as any)[testCase.toLowerCase()]("MESSAGE");

            // Assert
            expect(spy).toHaveBeenCalledWith(expect.stringContaining(testCase));
            expect(spy).toHaveBeenCalledWith(
                expect.stringMatching("FILE[s\n]*MESSAGE"),
            );
        });

        it("should prefix with file:line reference", () => {
            // Arrange
            const NullLogger = new Logger();
            const spy = jest.spyOn(NullLogger, "log");
            const logger = new FileReferenceLogger("FILE", NullLogger);

            // Act
            (logger as any)[testCase.toLowerCase()]("MESSAGE", 42);

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.stringMatching("FILE:42[s\n]*MESSAGE"),
            );
        });
    });

    describe.each(["error", "log", "warn", "info"] as Array<keyof ILog>)(
        "#%s",
        (testCase) => {
            it("should prefix with default file reference", () => {
                // Arrange
                const NullLogger = new Logger();
                const spy = jest.spyOn(NullLogger, testCase);
                const logger = new FileReferenceLogger("FILE", NullLogger);

                // Act
                (logger as any)[testCase]("MESSAGE");

                // Assert
                expect(spy).toHaveBeenCalledWith(
                    expect.stringMatching("FILE[s\n]*MESSAGE"),
                );
            });

            it("should prefix with file:line reference", () => {
                // Arrange
                const NullLogger = new Logger();
                const spy = jest.spyOn(NullLogger, testCase);
                const logger = new FileReferenceLogger("FILE", NullLogger);

                // Act
                (logger as any)[testCase]("MESSAGE", 42);

                // Assert
                expect(spy).toHaveBeenCalledWith(
                    expect.stringMatching("FILE:42[s\n]*MESSAGE"),
                );
            });
        },
    );
});
