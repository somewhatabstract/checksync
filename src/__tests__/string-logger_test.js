// @flow
import * as GetPathSeparator from "../get-path-separator.js";

import StringLogger from "../string-logger.js";

describe("StringLogger", () => {
    it.each(["log", "info", "warn", "error"])(
        "should add %s call to log",
        (testCase) => {
            // Arrange
            const logger = new StringLogger();

            // Act
            (logger: any)[testCase]("MESSAGE");
            const result = logger.getLog();

            // Assert
            expect(result).toMatchSnapshot(testCase);
        },
    );

    describe("normalizing path separators", () => {
        describe("windows", () => {
            it("should convert backslashes to forward slashes", () => {
                // Arrange
                const logger = new StringLogger();
                jest.spyOn(
                    GetPathSeparator,
                    "getPathSeparator",
                ).mockReturnValue("\\");

                // Act
                logger.log("C:\\SYSTEM");
                const result = logger.getLog();

                // Assert
                expect(result).toEqual("C:/SYSTEM");
            });

            it("should convert double backslashes to a single forward slashes", () => {
                // Arrange
                const logger = new StringLogger();
                jest.spyOn(
                    GetPathSeparator,
                    "getPathSeparator",
                ).mockReturnValue("\\");

                // Act
                const obj = {
                    dir: "C:\\SYSTEM",
                };
                logger.log(JSON.stringify(obj));
                const result = JSON.parse(logger.getLog());

                // Assert
                expect(result.dir).toEqual("C:/SYSTEM");
            });
        });
    });

    describe("#group", () => {
        it("should add group line to log", () => {
            // Arrange
            const logger = new StringLogger();

            // Act
            logger.group("GROUP!");
            const result = logger.getLog();

            // Assert
            expect(result).toMatchInlineSnapshot(`"<group GROUP! >"`);
        });

        it("should indent subsequent calls by group level", () => {
            // Arrange
            const logger = new StringLogger();

            // Act
            logger.group();
            logger.group();
            logger.group();
            logger.log("I'M INDENTED 3 times!");
            const results = logger.getLog().split("\n");

            // Assert
            expect(results[results.length - 1]).toStartWith("      ");
        });
    });

    describe("#groupEnd", () => {
        it("should not add anything if no group started", () => {
            // Arrange
            const logger = new StringLogger();

            // Act
            logger.groupEnd();
            const result = logger.getLog();

            // Assert
            expect(result).toBeEmpty();
        });

        it("should add group end line to log", () => {
            // Arrange
            const logger = new StringLogger();

            // Act
            logger.group("GROUP!");
            logger.groupEnd();
            const result = logger.getLog();

            // Assert
            expect(result).toMatchInlineSnapshot(`
                "<group GROUP! >
                <end_group>"
            `);
        });
    });
});
