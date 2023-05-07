import chalk from "chalk";
import * as CwdRelativePath from "../cwd-relative-path";

import Format from "../format";

describe("Format", () => {
    describe("#verbose", () => {
        it("should prefix with Verbose", () => {
            // Arrange

            // Act
            const result = Format.verbose("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.verbose("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#info", () => {
        it("should prefix with _INFO__", () => {
            // Arrange

            // Act
            const result = Format.info("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.info("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#error", () => {
        it("should prefix with _ERROR__", () => {
            // Arrange

            // Act
            const result = Format.error("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.error("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#warn", () => {
        it("should prefix with _WARNING__", () => {
            // Arrange

            // Act
            const result = Format.warn("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.warn("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#mismatch", () => {
        it("should prefix with _MISMATCH__", () => {
            // Arrange

            // Act
            const result = Format.mismatch("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.mismatch("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#fix", () => {
        it("should prefix with _FIX_", () => {
            // Arrange

            // Act
            const result = Format.fix("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.fix("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#cwdFilePath", () => {
        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.cwdFilePath("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });

        it("should turn path into relative path", () => {
            // Arrange
            jest.spyOn(CwdRelativePath, "default").mockReturnValue(
                "RELATIVE_PATH",
            );

            // Act
            const result = Format.cwdFilePath("/Users/test/test/test.js");

            // Assert
            expect(result).toBe("RELATIVE_PATH");
        });
    });

    describe("#code", () => {
        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.code("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });

    describe("#heading", () => {
        it("should render with chalk colors", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.heading("Test");

            // Assert
            expect(result).toMatchSnapshot();
        });
    });
});
