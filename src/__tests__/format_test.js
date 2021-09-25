// @flow
import chalk from "chalk";
import * as CwdRelativePath from "../cwd-relative-path.js";

import Format from "../format.js";

describe("Format", () => {
    describe("#verbose", () => {
        it("should prefix with _VERBOSE_", () => {
            // Arrange

            // Act
            const result = Format.verbose("Test");

            // Assert
            expect(result).toBe(" VERBOSE  Test");
        });

        it("should render black text on grey and dimmed text", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.verbose("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[40m[90m VERBOSE [39m[49m[22m [2mTest[22m"`);
        });
    });

    describe("#info", () => {
        it("should prefix with _INFO__", () => {
            // Arrange

            // Act
            const result = Format.info("Test");

            // Assert
            expect(result).toBe(" INFO  Test");
        });

        it("should render black text on blue", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.info("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[30m[44m INFO [49m[39m Test"`);
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

        it("should render bold white text on red", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.error("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[37m[41m ERROR [49m[39m[22m Test"`);
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

        it("should render bold black text on yellow", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.warn("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[30m[43m WARNING [49m[39m[22m Test"`);
        });
    });

    describe("#mismatch", () => {
        it("should prefix with _MISMATCH__", () => {
            // Arrange

            // Act
            const result = Format.mismatch("Test");

            // Assert
            expect(result).toBe(" MISMATCH  Test");
        });

        it("should render bold black text on bright yellow", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.mismatch("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[30m[103m MISMATCH [49m[39m[22m Test"`);
        });
    });

    describe("#fix", () => {
        it("should prefix with _FIX_", () => {
            // Arrange

            // Act
            const result = Format.fix("Test");

            // Assert
            expect(result).toBe(" FIX  Test");
        });

        it("should render bold black text on bright green", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.fix("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[30m[102m FIX [49m[39m[22m Test"`);
        });
    });

    describe("#cwdFilePath", () => {
        it("should render gray text", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.cwdFilePath("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[90mTest[39m"`);
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
        it("should render bold yellow text", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.code("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[33mTest[39m[22m"`);
        });
    });

    describe("#heading", () => {
        it("should render bold green text", () => {
            // Arrange
            chalk.level = 1;

            // Act
            const result = Format.heading("Test");

            // Assert
            expect(result).toMatchInlineSnapshot(`"[1m[32mTest[39m[22m"`);
        });
    });
});
