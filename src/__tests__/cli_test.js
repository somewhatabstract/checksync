// @flow
import * as minimist from "minimist";

import fs from "fs";
import {run} from "../cli.js";
import * as CheckSync from "../check-sync.js";
import ExitCodes from "../exit-codes.js";
import Logger from "../logger.js";
import {version} from "../../package.json";
import * as DetermineOptions from "../determine-options.js";
import defaultOptions from "../default-options.js";

jest.mock("minimist");
jest.mock("../logger.js", () => {
    const realLogger = jest.requireActual("../logger.js").default;
    const log = new realLogger(null);
    for (const key of Object.keys(log)) {
        if (typeof log[key] === "function") {
            jest.spyOn(log, key);
        }
    }
    return function () {
        return log;
    };
});
jest.mock("parse-gitignore");
jest.mock("fs");

describe("#run", () => {
    it("should parse args", async () => {
        // Arrange
        const fakeParsedArgs = {
            fix: false,
            comments: "//,#",
            ignoreFile: undefined,
        };
        const minimistSpy = jest
            .spyOn(minimist, "default")
            .mockReturnValue(fakeParsedArgs);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        jest.spyOn(process, "exit").mockImplementationOnce(() => {});

        // Act
        await run(__filename);

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
                [argName]: true,
            };
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
            version: true,
        };
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
            help: true,
        };
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

    it("should pass arguments to determineOptions", async () => {
        // Arrange
        const fakeParsedArgs = {
            some: "args",
        };
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        const determineOptionsSpy = jest
            .spyOn(DetermineOptions, "default")
            .mockResolvedValue(defaultOptions);
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        jest.spyOn(process, "exit").mockImplementationOnce(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(determineOptionsSpy).toHaveBeenCalledWith(
            fakeParsedArgs,
            expect.any(Object),
        );
    });

    it("should invoke checkSync with determined options", async () => {
        // Arrange
        const fakeOptions = {
            ...defaultOptions,
            autoFix: true,
            comments: ["COMMENT1", "COMMENT2"],
            ignoreFiles: ["madeupfile"],
            excludeGlobs: ["glob1", "glob2"],
            includeGlobs: ["globs", "and globs"],
        };
        jest.spyOn(minimist, "default").mockReturnValue({});
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(fakeOptions);
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockResolvedValue(0);
        jest.spyOn(process, "exit").mockImplementationOnce(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(checkSyncSpy).toHaveBeenCalledWith(
            fakeOptions,
            expect.any(Object),
        );
    });

    it("should set logging to verbose when --verbose specified", async () => {
        const fakeParsedArgs = {
            verbose: true,
        };
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
        jest.spyOn(process, "exit").mockImplementationOnce(() => {});
        const setVerboseSpy = jest.spyOn(new Logger(null), "setVerbose");

        // Act
        await run(__filename);

        // Assert
        expect(setVerboseSpy).toHaveBeenCalledTimes(1);
    });

    it("should exit process with the BAD_CONFIG code on determineOptions rejection", async () => {
        // Arrange
        jest.spyOn(DetermineOptions, "default").mockRejectedValue(
            new Error("Oh no, booms!"),
        );
        jest.spyOn(minimist, "default").mockReturnValue({});
        const exitSpy = jest
            .spyOn(process, "exit")
            .mockImplementationOnce(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(ExitCodes.BAD_CONFIG);
    });

    it("should exit process with the exit code from checkSync", async () => {
        // Arrange
        jest.spyOn(CheckSync, "default").mockResolvedValue(42);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(minimist, "default").mockReturnValue({});
        const exitSpy = jest
            .spyOn(process, "exit")
            .mockImplementationOnce(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(42);
    });

    it("should log error on rejection of checkSync method", async () => {
        // Arrange
        jest.spyOn(CheckSync, "default").mockRejectedValue(
            new Error("Oh no, booms!"),
        );
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(minimist, "default").mockReturnValue({});
        jest.spyOn(process, "exit").mockImplementation(() => {});
        const logSpy = jest.spyOn(new Logger(null), "error");

        // Act
        await run(__filename);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            "Unexpected error: Error: Oh no, booms!",
        );
    });

    it("should exit with CATASTROPHIC code on rejection of checkSync method", async () => {
        // Arrange
        jest.spyOn(CheckSync, "default").mockRejectedValue(
            new Error("Oh no, booms!"),
        );
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(minimist, "default").mockReturnValue({});
        const exitSpy = jest
            .spyOn(process, "exit")
            .mockImplementation(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(ExitCodes.CATASTROPHIC);
    });

    describe("unknown arg handling", () => {
        it("should return false for process.execPath", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            jest.spyOn(process, "exit").mockImplementationOnce(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler(process.execPath);

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for the given launchfile path", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            jest.spyOn(process, "exit").mockImplementationOnce(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler(__filename);

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for .bin command", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            jest.spyOn(process, "exit").mockImplementationOnce(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("/Some/Path/To/.bin/checksync");

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for symlinked launch file", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            jest.spyOn(process, "exit").mockImplementationOnce(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            jest.spyOn(fs, "realpathSync").mockReturnValue(
                __filename, // Symlink resolves to our run file
            );
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("/usr/local/bin/checksync");

            // Assert
            expect(result).toBeFalse();
        });

        it("should exit on unknown arguments starting with -", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            const exitSpy = jest
                .spyOn(process, "exit")
                .mockImplementation(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            unknownHandler("--imadethisup");

            // Assert
            expect(exitSpy).toHaveBeenCalledWith(ExitCodes.UNKNOWN_ARGS);
        });

        it("should report unknown arguments starting with -", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            jest.spyOn(process, "exit").mockImplementation(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            const logSpy = jest.spyOn(new Logger(null), "error");
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            unknownHandler("--imadethisup");

            // Assert
            expect(logSpy).toHaveBeenCalledWith(
                "Unknown argument: --imadethisup",
            );
        });

        it("should return true for non-argument args (i.e. files)", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            jest.spyOn(DetermineOptions, "default").mockResolvedValue(
                defaultOptions,
            );
            jest.spyOn(process, "exit").mockImplementation(() => {});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue({});
            await run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("somethingelse");

            // Assert
            expect(result).toBeTrue();
        });
    });
});
