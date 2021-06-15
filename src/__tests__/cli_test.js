// @flow
import * as minimist from "minimist";

import fs from "fs";
import {run} from "../cli.js";
import * as CheckSync from "../check-sync.js";
import ExitCodes from "../exit-codes.js";
import Logger from "../logger.js";
import defaultArgs from "../default-args.js";
import * as ParseGitIgnore from "parse-gitignore";
import {version} from "../../package.json";

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

    it.each(["help", "version"])(
        "should exit with success if %s arg present",
        (argName) => {
            // Arrange
            const fakeParsedArgs = {
                ...defaultArgs,
                [argName]: true,
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
            expect(exitSpy).toHaveBeenCalledWith(ExitCodes.SUCCESS);
        },
    );

    it("should log version if version arg present", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            version: true,
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
        expect(logSpy).toHaveBeenCalledWith(version);
    });

    it("should log help info if help arg present", () => {
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
                json: false,
                rootMarker: undefined,
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
                json: false,
                rootMarker: undefined,
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
                json: false,
                rootMarker: undefined,
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
                json: false,
                rootMarker: undefined,
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

    it("should exit process with given exit code when checkSync method resolves", () => {
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
        jest.spyOn(ParseGitIgnore, "default").mockReturnValue(["madeupglob"]);
        run(__filename);
        const resolveHandler = thenMock.mock.calls[0][0];

        // Act
        resolveHandler(99);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(99);
    });

    it("should log error on rejection of checkSync method", () => {
        // Arrange
        const fakeParsedArgs = {
            ...defaultArgs,
            fix: false,
            comments: "//,#",
        };
        const thenMock = jest.fn();
        jest.spyOn(CheckSync, "default").mockReturnValue({then: thenMock});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(process, "exit").mockImplementation(jest.fn());
        jest.spyOn(ParseGitIgnore, "default").mockReturnValue(["madeupglob"]);
        const logSpy = jest.spyOn(new Logger(null), "error");
        run(__filename);
        const rejectHandler = thenMock.mock.calls[0][1];

        // Act
        rejectHandler(new Error("Oh no, booms!"));

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            "Unexpected error: Error: Oh no, booms!",
        );
    });

    it("should exit with CATASTROPHIC code on rejection of checkSync method", () => {
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
        jest.spyOn(ParseGitIgnore, "default").mockReturnValue(["madeupglob"]);
        run(__filename);
        const rejectHandler = thenMock.mock.calls[0][1];

        // Act
        rejectHandler();

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(ExitCodes.CATASTROPHIC);
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
            jest.spyOn(fs, "realpathSync").mockReturnValue(
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
            expect(exitSpy).toHaveBeenCalledWith(ExitCodes.UNKNOWN_ARGS);
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
    });
});
