// @flow
import Format from "../format";

describe("Format", () => {
    describe("#info", () => {
        it("should prefix with _INFO__", () => {
            // Arrange

            // Act
            const result = Format.info("Test");

            // Assert
            expect(result).toBe(" INFO  Test");
        });
    });

    describe("#error", () => {
        it("should prefix with _ERROR__", () => {
            // Arrange

            // Act
            const result = Format.error("Test");

            // Assert
            expect(result).toBe(" ERROR  Test");
        });
    });

    describe("#warn", () => {
        it("should prefix with _WARNING__", () => {
            // Arrange

            // Act
            const result = Format.warn("Test");

            // Assert
            expect(result).toBe(" WARNING  Test");
        });
    });

    describe("#violation", () => {
        it("should prefix with _MISMATCH__", () => {
            // Arrange

            // Act
            const result = Format.violation("Test");

            // Assert
            expect(result).toBe(" MISMATCH  Test");
        });
    });
});
