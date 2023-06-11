import "jest-extended";

import * as fs from "fs";
import * as FG from "fast-glob";
import defaultOptions from "../default-options";
import Logger from "../logger";
import StringLogger from "../string-logger";

import * as IgnoreFilesToFunctions from "../ignore-files-to-functions";
import ignoreFileGlobsToAllowPredicate from "../ignore-file-globs-to-allow-predicate";

jest.mock("fast-glob");
jest.mock("fs");
jest.mock("../ignore-files-to-functions");

/**
 * StringLogger needs ancesdir but our mocking of fs will break it.
 * So we implement a very basic version that does what we need.
 */
jest.mock("ancesdir", () => {
    const pathReal = jest.requireActual("path");
    const ancesdirValue = pathReal.dirname(pathReal.dirname(__dirname));
    return {
        __esModule: true,
        default: () => ancesdirValue,
    };
});

describe("ignoreFileGlobsToAllowPredicate", () => {
    describe("when the ignore file globs are just the defaults and the default ignore file does not exist", () => {
        it("should return a predicate that returns true", async () => {
            // Arrange
            const NullLogger = new Logger(null);
            jest.spyOn(fs, "existsSync").mockReturnValue(false);

            // Act
            const predicate = await ignoreFileGlobsToAllowPredicate(
                defaultOptions.ignoreFiles,
                NullLogger,
            );

            // Assert
            expect(predicate("/foo")).toBe(true);
        });
    });

    describe("when there are no ignore file globs", () => {
        it("should return a predicate that returns true", async () => {
            // Arrange
            const NullLogger = new Logger(null);
            jest.spyOn(IgnoreFilesToFunctions, "default").mockResolvedValue([]);

            // Act
            const predicate = await ignoreFileGlobsToAllowPredicate(
                [],
                NullLogger,
            );

            // Assert
            expect(predicate("/foo")).toBe(true);
        });
    });

    describe("when there are matching ignore files for the given globs", () => {
        beforeEach(() => {
            jest.spyOn(FG, "default").mockResolvedValue([
                "/absolute/path/to/.gitignore1",
                "/absolute/path/to/.gitignore2",
            ]);
        });

        it("should verbose log the matched files", async () => {
            // Arrange
            const logger = new StringLogger(true);
            jest.spyOn(IgnoreFilesToFunctions, "default").mockResolvedValue([]);

            // Act
            await ignoreFileGlobsToAllowPredicate(
                [
                    "/absolute/path/to/.gitignore1",
                    "/absolute/path/to/.gitignore2",
                ],
                logger,
            );
            const log = logger.getLog();

            // Assert
            expect(log).toMatchInlineSnapshot(`
                "Verbose  Ignore files: [
                    "/absolute/path/to/.gitignore1",
                    "/absolute/path/to/.gitignore2"
                ]"
            `);
        });

        describe("the returned predicate", () => {
            it("should throw if the given file path is not absolute", async () => {
                // Arrange
                const NullLogger = new Logger(null);
                const predicate = await ignoreFileGlobsToAllowPredicate(
                    ["/foo/.gitignore"],
                    NullLogger,
                );

                // Act
                const result = () => predicate("bar");

                // Assert
                expect(result).toThrowErrorMatchingInlineSnapshot(
                    `"Expected absolute file path."`,
                );
            });

            it("should invoke each gitignore predicate with the given file path", async () => {
                // Arrange
                const NullLogger = new Logger(null);
                const gitignore1Predicate = jest.fn(() => true);
                const gitignore2Predicate = jest.fn(() => true);
                jest.spyOn(IgnoreFilesToFunctions, "default").mockResolvedValue(
                    [gitignore1Predicate, gitignore2Predicate],
                );

                // Act
                const predicate = await ignoreFileGlobsToAllowPredicate(
                    [
                        "/absolute/path/to/.gitignore1",
                        "/absolute/path/to/.gitignore2",
                    ],
                    NullLogger,
                );
                predicate("/foo");

                // Assert
                expect(gitignore1Predicate).toHaveBeenCalledWith("/foo");
                expect(gitignore2Predicate).toHaveBeenCalledWith("/foo");
            });

            it("should return true if each gitignore predicate returns undefined", async () => {
                // Arrange
                const NullLogger = new Logger(null);
                jest.spyOn(IgnoreFilesToFunctions, "default").mockResolvedValue(
                    [() => undefined, () => undefined, () => undefined],
                );

                // Act
                const predicate = await ignoreFileGlobsToAllowPredicate(
                    [
                        "/absolute/path/to/.gitignore1",
                        "/absolute/path/to/.gitignore2",
                    ],
                    NullLogger,
                );

                // Assert
                expect(predicate("/foo")).toBeTrue();
            });

            it("should return true if the last gitignore predicate called that returned a boolean returned true", async () => {
                // Arrange
                const NullLogger = new Logger(null);
                jest.spyOn(IgnoreFilesToFunctions, "default").mockResolvedValue(
                    [() => false, () => true, () => undefined],
                );

                // Act
                const predicate = await ignoreFileGlobsToAllowPredicate(
                    [
                        "/absolute/path/to/.gitignore1",
                        "/absolute/path/to/.gitignore2",
                    ],
                    NullLogger,
                );

                // Assert
                expect(predicate("/foo")).toBeTrue();
            });

            it("should return false if the last gitignore predicate called that returned a boolean returned false", async () => {
                // Arrange
                const NullLogger = new Logger(null);
                jest.spyOn(IgnoreFilesToFunctions, "default").mockResolvedValue(
                    [() => true, () => false, () => undefined],
                );

                // Act
                const predicate = await ignoreFileGlobsToAllowPredicate(
                    [
                        "/absolute/path/to/.gitignore1",
                        "/absolute/path/to/.gitignore2",
                    ],
                    NullLogger,
                );

                // Assert
                expect(predicate("/foo")).toBeFalse();
            });
        });
    });
});
