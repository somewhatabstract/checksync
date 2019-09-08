// @flow
import chalk from "chalk";
import Format from "../format";

describe("Format", () => {
    beforeAll(() => {
        chalk.enabled = false;
    });

    afterAll(() => {
        chalk.enabled = true;
    });

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
});
