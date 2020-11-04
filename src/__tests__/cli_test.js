// @flow
import * as minimist from "minimist";

import fs from "fs";
import path from "path";
import {run} from "../cli.js";
import * as CheckSync from "../check-sync.js";
import ErrorCodes from "../error-codes.js";
import Logger from "../logger.js";
import defaultArgs from "../default-args.js";
import * as ParseGitIgnore from "parse-gitignore";

jest.mock("minimist");
jest.mock("../logger.js", () => {
    const realLogger = jest.requireActual("../logger.js").default;
    const log = new realLogger(null);
    for (const key of Object.keys(log)) {
        if (typeof log[key] !== "function") {
            continue;
        }
        jest.spyOn(log, key);
    }
    return function () {
        return log;
    };
});
jest.mock("parse-gitignore");
jest.mock("fs");
jest.mock("path");

describe("#run", () => {
    it("should parse args", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            fix: false,
            comments: "//,#",
            ignoreFile: undefined,
        };
        jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
        const minimistSpy = jest
            .spyOn(minimist, "default")
            .mockReturnValue(fakeParsedArgs);

        // Act
        run(__filename);

        // Assert
        expect(minimistSpy).toHaveBeenCalledWith(
            process.argv,
            expect.any(Object),
        );
    });

    it("should exit with success if help arg present", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            help: true,
        };
        jest.spyOn(CheckSync, "default");
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        const exitSpy = jest
            .spyOn(process, "exit")
            .mockImplementationOnce(() => {
                throw new Error("PRETEND PROCESS EXIT!");
            });

        // Act
        const underTest = () => run(__filename);

        // Assert
        expect(underTest).toThrowError("PRETEND PROCESS EXIT!");
        expect(exitSpy).toHaveBeenCalledWith(ErrorCodes.SUCCESS);
    });

    it("should log help info help arg present", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            help: true,
        };
        jest.spyOn(CheckSync, "default");
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(process, "exit").mockImplementationOnce(() => {
            throw new Error("PRETEND PROCESS EXIT!");
        });
        const logSpy = jest.spyOn(new Logger(null), "log");

        // Act
        const underTest = () => run(__filename);

        // Assert
        expect(underTest).toThrow();
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0][0]).toMatchSnapshot();
    });

    it("should invoke checkSync with parsed args", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            updateTags: true,
            comments: "COMMENT1,COMMENT2",
            ignoreFiles: "madeupfile",
            _: ["globs", "and globs"],
        };
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(ParseGitIgnore, "default").mockReturnValue(["madeupglob"]);

        // Act
        run(__filename);

        // Assert
        expect(checkSyncSpy).toHaveBeenCalledWith(
            {
                includeGlobs: fakeParsedArgs._,
                excludeGlobs: ["madeupglob"],
                dryRun: false,
                autoFix: true,
                comments: ["COMMENT1", "COMMENT2"],
            },
            expect.any(Object),
        );
    });

    it("should skip ignore file if left default and file does not exist", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            updateTags: true,
            comments: "COMMENT1,COMMENT2",
            _: ["globs", "and globs"],
        };
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);

        // Act
        run(__filename);

        // Assert
        expect(checkSyncSpy).toHaveBeenCalledWith(
            {
                includeGlobs: fakeParsedArgs._,
                excludeGlobs: [],
                dryRun: false,
                autoFix: true,
                comments: ["COMMENT1", "COMMENT2"],
            },
            expect.any(Object),
        );
    });

    it("should skip ignore file if --no-ignore-file specified", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            updateTags: true,
            ignoreFile: "something",
            noIgnoreFile: true,
            comments: "COMMENT1,COMMENT2",
            _: ["globs", "and globs"],
        };
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);

        // Act
        run(__filename);

        // Assert
        expect(checkSyncSpy).toHaveBeenCalledWith(
            {
                includeGlobs: fakeParsedArgs._,
                excludeGlobs: [],
                dryRun: false,
                autoFix: true,
                comments: ["COMMENT1", "COMMENT2"],
            },
            expect.any(Object),
        );
    });

    it("should combine exclude rules from given ignore files", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            updateTags: true,
            ignoreFiles: "IGNOREFILEA,IGNOREFILEB",
            comments: "COMMENT1,COMMENT2",
            _: ["globs", "and globs"],
        };
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(ParseGitIgnore, "default").mockReturnValueOnce([
            "IGNORE1",
            "IGNORE2",
        ]);
        jest.spyOn(ParseGitIgnore, "default").mockReturnValueOnce([
            "IGNORE1",
            "IGNORE3",
        ]);

        // Act
        run(__filename);

        // Assert
        expect(checkSyncSpy).toHaveBeenCalledWith(
            {
                includeGlobs: fakeParsedArgs._,
                excludeGlobs: ["IGNORE1", "IGNORE2", "IGNORE1", "IGNORE3"],
                dryRun: false,
                autoFix: true,
                comments: ["COMMENT1", "COMMENT2"],
            },
            expect.any(Object),
        );
    });

    it("should set logging to verbose when --verbose specified", () => {
        const fakeParsedArgs = {
            ...defaultArgs,
            noIgnoreFile: true,
            comments: "COMMENT1,COMMENT2",
            verbose: true,
            _: ["globs", "and globs"],
        };
        jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
        const setVerboseSpy = jest.spyOn(new Logger(null), "setVerbose");

        // Act
        run(__filename);

        // Assert
        expect(setVerboseSpy).toHaveBeenCalledTimes(1);
    });

    describe("unknown arg handling", () => {
        it("should return false for process.execPath", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler(process.execPath);

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for the given launchfile path", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler(__filename);

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for .bin command", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("/Some/Path/To/.bin/checksync");

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for symlinked launch file", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            jest.spyOn(fs, "readlinkSync").mockReturnValue("/doesnt/matter");
            jest.spyOn(path, "resolve").mockReturnValue(
                __filename, // Symlink resolves to our run file
            );
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("/usr/local/bin/checksync");

            // Assert
            expect(result).toBeFalse();
        });

        it("should exit on unknown arguments starting with -", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            const exitSpy = jest
                .spyOn(process, "exit")
                .mockImplementationOnce(() => {});
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            unknownHandler("--imadethisup");

            // Assert
            expect(exitSpy).toHaveBeenCalledWith(ErrorCodes.UNKNOWN_ARGS);
        });

        it("should report unknown arguments starting with -", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            jest.spyOn(process, "exit").mockImplementationOnce(() => {});
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            const logSpy = jest.spyOn(new Logger(null), "error");
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            unknownHandler("--imadethisup");

            // Assert
            expect(logSpy).toHaveBeenCalledWith(
                "Unknown argument: --imadethisup",
            );
        });

        it("should return true for non-argument args (i.e. files)", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("somethingelse");

            // Assert
            expect(result).toBeTrue();
        });

        it("should exit process with given exit code", () => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                fix: false,
                comments: "//,#",
            };
            const thenMock = jest.fn();
            jest.spyOn(CheckSync, "default").mockReturnValue({then: thenMock});
            jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
            const exitSpy = jest
                .spyOn(process, "exit")
                .mockImplementation(jest.fn());
            jest.spyOn(ParseGitIgnore, "default").mockReturnValue([
                "madeupglob",
            ]);
            run(__filename);
            const thenHandler = thenMock.mock.calls[0][0];

            // Act
            thenHandler(99);

            // Assert
            expect(exitSpy).toHaveBeenCalledWith(99);
        });
    });
});
