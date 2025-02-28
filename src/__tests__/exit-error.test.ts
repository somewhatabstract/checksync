import {ExitCode} from "../exit-codes";
import {ExitError} from "../exit-error";

describe("ExitError", () => {
    it("should be an Error", () => {
        // Arrange

        // Act
        const result = new ExitError("message", 1);

        // Assert
        expect(result).toBeInstanceOf(Error);
    });

    describe("message", () => {
        it("should match the value passed ot the constructor", () => {
            // Arrange
            const message = "BOOM!";

            // Act
            const result = new ExitError(message, 1, {
                cause: new Error("cause"),
            });

            // Assert
            expect(result.message).toBe(message);
        });
    });

    describe("cause", () => {
        it("should match the value passed to the constructor", () => {
            // Arrange
            const cause = new Error("cause");

            // Act
            const result = new ExitError("message", 1, {cause});

            // Assert
            expect(result.cause).toBe(cause);
        });
    });

    describe("name", () => {
        it("should be 'ExitError'", () => {
            // Arrange

            // Act
            const result = new ExitError("message", 1);

            // Assert
            expect(result.name).toBe("ExitError");
        });
    });

    describe("exitCode", () => {
        it.each`
            code
            ${ExitCode.CATASTROPHIC}
            ${42 as ExitCode}
        `(
            "should match the exit code, $code, given in the constructor",
            ({code}) => {
                // Arrange

                // Act
                const result = new ExitError("message", code);

                // Assert
                expect(result.exitCode).toBe(code);
            },
        );
    });

    describe("toString", () => {
        it("should return a string with the error name, message and exit code", () => {
            // Arrange
            const error = new ExitError("BOOM!", 42 as ExitCode);

            // Act
            const result = error.toString();

            // Assert
            expect(result).toMatchInlineSnapshot(
                `"ExitError: BOOM! (Exit code: 42)"`,
            );
        });
    });
});
