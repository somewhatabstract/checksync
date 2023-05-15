import "jest-extended";

import * as fsasync from "fs/promises";
import * as ignore from "ignore";
import Logger from "../logger";
//import StringLogger from "../string-logger";

import ignoreFileToAllowPredicate from "../ignore-file-to-function";

jest.mock("fs/promises");
jest.mock("ignore");

describe("ignoreFileToAllowPredicate", () => {
    it("should resolve to a function", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(ignore, "default").mockReturnValue({
            add: jest.fn(),
        } as any);
        jest.spyOn(fsasync, "readFile").mockResolvedValue("");

        // Act
        const result = await ignoreFileToAllowPredicate(
            "/foo/.gitignore",
            NullLogger,
        );

        // Assert
        expect(result).toBeFunction();
    });

    it("should use the contents of the given file to configure an ignore filter", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(fsasync, "readFile").mockResolvedValue("foo\n!bar\n");
        const addSpy = jest.fn();
        jest.spyOn(ignore, "default").mockReturnValue({
            add: addSpy,
        } as any);

        // Act
        await ignoreFileToAllowPredicate("/foo/.gitignore", NullLogger);

        // Assert
        expect(addSpy).toHaveBeenCalledWith("foo\n!bar\n");
    });

    describe("the returned function", () => {
        it("should return undefined if the given file path is not in a directory governed by the ignore file", async () => {
            // Arrange
            const NullLogger = new Logger(null);
            jest.spyOn(ignore, "default").mockReturnValue({
                add: jest.fn(),
            } as any);
            jest.spyOn(fsasync, "readFile").mockResolvedValue("*.txt\n");
            const predicate = await ignoreFileToAllowPredicate(
                "/foo/bar/baz.gitignore",
                NullLogger,
            );

            // Act
            const result = predicate("/foo/myfile.txt");

            // Assert
            expect(result).toBeUndefined();
        });

        it("should return undefined if the given file path is in a directory governed by the ignore file but the ignore file has no opinion on that file", async () => {
            // Arrange
            const NullLogger = new Logger(null);
            jest.spyOn(ignore, "default").mockReturnValue({
                add: jest.fn().mockReturnThis(),
                test: jest.fn(() => ({
                    ignored: false,
                    unignored: false,
                })),
            } as any);
            jest.spyOn(fsasync, "readFile").mockResolvedValue("*.txt\n");
            const predicate = await ignoreFileToAllowPredicate(
                "/foo/bar/baz.gitignore",
                NullLogger,
            );

            // Act
            const result = predicate("/foo/bar/myfile.txt");

            // Assert
            expect(result).toBeUndefined();
        });

        it("should return false if the given file path is in a directory governed by the ignore file and the ignore file indicates the file should be ignored", async () => {
            // Arrange
            const NullLogger = new Logger(null);
            jest.spyOn(ignore, "default").mockReturnValue({
                add: jest.fn().mockReturnThis(),
                test: jest.fn(() => ({
                    ignored: true,
                    unignored: false,
                })),
            } as any);
            jest.spyOn(fsasync, "readFile").mockResolvedValue("*.txt\n");
            const predicate = await ignoreFileToAllowPredicate(
                "/foo/bar/baz.gitignore",
                NullLogger,
            );

            // Act
            const result = predicate("/foo/bar/myfile.txt");

            // Assert
            expect(result).toBeFalse();
        });

        it("should return true if the given file path is in a directory governed by the ignore file and the ignore file indicates the file should be unignored", async () => {
            // Arrange
            const NullLogger = new Logger(null);
            jest.spyOn(ignore, "default").mockReturnValue({
                add: jest.fn().mockReturnThis(),
                test: jest.fn(() => ({
                    ignored: false,
                    unignored: true,
                })),
            } as any);
            jest.spyOn(fsasync, "readFile").mockResolvedValue("*.txt\n");
            const predicate = await ignoreFileToAllowPredicate(
                "/foo/bar/baz.gitignore",
                NullLogger,
            );

            // Act
            const result = predicate("/foo/bar/myfile.txt");

            // Assert
            expect(result).toBeTrue();
        });
    });
});
