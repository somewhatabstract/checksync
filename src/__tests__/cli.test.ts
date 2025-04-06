import "jest-extended";

import fs from "fs";
import {run} from "../cli";
import * as CheckSync from "../check-sync";
import {ExitCode} from "../exit-codes";
import Logger from "../logger";
import {version} from "../../package.json";
import * as DetermineOptions from "../determine-options";
import defaultOptions from "../default-options";
import * as Exit from "../exit";
import * as SetCwd from "../set-cwd";
import * as ParseArgs from "../parse-args";

jest.mock("../set-cwd");
jest.mock("../parse-args");
jest.mock("../logger", () => {
    const realLogger = jest.requireActual("../logger").default;
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
jest.mock("fs");
jest.mock("../../package.json", () => ({
    // We don't use the real version so that snapshots are consistent.
    version: "0.0.0",
}));

describe("#run", () => {
    it("should parse args", async () => {
        // Arrange
        const fakeParsedArgs: any = {
            fix: false,
            comments: "//,#",
            ignoreFile: undefined,
        } as const;

        const parseArgsSpy = jest
            .spyOn(ParseArgs, "parseArgs")
            .mockResolvedValue(fakeParsedArgs);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        // @ts-expect-error this is typed to never, but we want to mock it
        jest.spyOn(Exit, "default").mockImplementation(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(parseArgsSpy).toHaveBeenCalledWith(expect.anything());
    });

    it.each(["help", "version"])(
        "should exit with success if %s arg present",
        async (argName) => {
            // Arrange
            const fakeParsedArgs: any = {
                [argName]: true,
            } as const;
            jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue(
                fakeParsedArgs,
            );
            const exitSpy = jest
                .spyOn(Exit, "default")
                .mockImplementation(() => {
                    throw new Error("PRETEND PROCESS EXIT!");
                });

            // Act
            const underTest = () => run(__filename);

            // Assert
            await expect(underTest).rejects.toThrow(
                Error("PRETEND PROCESS EXIT!"),
            );
            expect(exitSpy).toHaveBeenCalledWith(
                expect.anything(),
                ExitCode.SUCCESS,
            );
        },
    );

    it("should log version if version arg present", async () => {
        // Arrange
        const fakeParsedArgs: any = {
            version: true,
        } as const;
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue(fakeParsedArgs);
        jest.spyOn(Exit, "default").mockImplementation(() => {
            throw new Error("PRETEND PROCESS EXIT!");
        });
        const logSpy = jest.spyOn(new Logger(null), "log");

        // Act
        const underTest = () => run(__filename);

        // Assert
        await expect(underTest).rejects.toThrow();
        expect(logSpy).toHaveBeenCalledWith(version);
    });

    it("should log help info if help arg present", async () => {
        // Arrange
        const fakeParsedArgs: any = {
            help: true,
        } as const;
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue(fakeParsedArgs);
        jest.spyOn(Exit, "default").mockImplementation(() => {
            throw new Error("PRETEND PROCESS EXIT!");
        });
        const logSpy = jest.spyOn(new Logger(null), "log");

        // Act
        const underTest = () => run(__filename);

        // Assert
        await expect(underTest).rejects.toThrow();
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0][0]).toMatchSnapshot();
    });

    it("should change the working directory if cwd arg present", async () => {
        // Arrange
        const fakeParsedArgs: any = {
            cwd: "/some/path",
            verbose: true,
        } as const;
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue(fakeParsedArgs);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        // @ts-expect-error this is typed to never, but we want to mock it
        jest.spyOn(Exit, "default").mockImplementation(() => {});
        const setCwdSpy = jest.spyOn(SetCwd, "default");

        // Act
        await run(__filename);

        // Assert
        expect(setCwdSpy).toHaveBeenCalledWith(expect.anything(), "/some/path");
    });

    it("should pass arguments to determineOptions", async () => {
        // Arrange
        const fakeParsedArgs: any = {
            some: "args",
        } as const;
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue(fakeParsedArgs);
        const determineOptionsSpy = jest
            .spyOn(DetermineOptions, "default")
            .mockResolvedValue(defaultOptions);
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        // @ts-expect-error this is typed to never, but we want to mock it
        jest.spyOn(Exit, "default").mockImplementation(() => {});

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
        } as const;
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({} as any);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(fakeOptions);
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockResolvedValue(0);
        // @ts-expect-error this is typed to never, but we want to mock it
        jest.spyOn(Exit, "default").mockImplementation(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(checkSyncSpy).toHaveBeenCalledWith(
            fakeOptions,
            expect.any(Object),
        );
    });

    it("should set logging to verbose when --verbose specified", async () => {
        const fakeParsedArgs: any = {
            verbose: true,
        } as const;
        jest.spyOn(CheckSync, "default").mockResolvedValue(0);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue(fakeParsedArgs);
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
        // @ts-expect-error this is typed to never, but we want to mock it
        jest.spyOn(Exit, "default").mockImplementation(() => {});
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
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({} as any);
        const exitSpy = jest
            .spyOn(Exit, "default")
            // @ts-expect-error this is typed to never, but we want to mock it
            .mockImplementation(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(
            expect.anything(),
            ExitCode.BAD_CONFIG,
        );
    });

    it("should exit process with the exit code from checkSync", async () => {
        // Arrange
        jest.spyOn(CheckSync, "default").mockResolvedValue(42 as any);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({} as any);
        const exitSpy = jest
            .spyOn(Exit, "default")
            // @ts-expect-error this is typed to never, but we want to mock it
            .mockImplementation(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(expect.anything(), 42);
    });

    it("should log error on rejection of checkSync method", async () => {
        // Arrange
        const error = new Error("Oh no, booms!");
        jest.spyOn(CheckSync, "default").mockRejectedValue(error);
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({} as any);
        // @ts-expect-error this is typed to never, but we want to mock it
        jest.spyOn(Exit, "default").mockImplementation(() => {});
        const logSpy = jest.spyOn(new Logger(null), "error");

        // Act
        await run(__filename);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(error.stack);
    });

    it("should exit with CATASTROPHIC code on rejection of checkSync method", async () => {
        // Arrange
        jest.spyOn(CheckSync, "default").mockRejectedValue(
            new Error("Oh no, booms!"),
        );
        jest.spyOn(DetermineOptions, "default").mockResolvedValue(
            defaultOptions,
        );
        jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({} as any);
        const exitSpy = jest
            .spyOn(Exit, "default")
            // @ts-expect-error this is typed to never, but we want to mock it
            .mockImplementation(() => {});

        // Act
        await run(__filename);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(
            expect.anything(),
            ExitCode.CATASTROPHIC,
        );
    });

    describe("unknown arg handling", () => {
        it("should remove process.execPath from _ arg", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            const determineOptionSpy = jest
                .spyOn(DetermineOptions, "default")
                .mockResolvedValue(defaultOptions);
            // @ts-expect-error this is typed to never, but we want to mock it
            jest.spyOn(Exit, "default").mockImplementation(() => {});
            jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({
                _: [process.execPath, "somethingelse"],
            } as any);

            // Act
            await run(__filename);

            // Assert
            expect(determineOptionSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    _: ["somethingelse"],
                }),
                expect.any(Object),
            );
        });

        it("should remove launchfile parth from _ arg", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            const determineOptionSpy = jest
                .spyOn(DetermineOptions, "default")
                .mockResolvedValue(defaultOptions);
            // @ts-expect-error this is typed to never, but we want to mock it
            jest.spyOn(Exit, "default").mockImplementation(() => {});
            jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({
                _: [__filename, "somethingelse"],
            } as any);

            // Act
            await run(__filename);

            // Assert
            expect(determineOptionSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    _: ["somethingelse"],
                }),
                expect.any(Object),
            );
        });

        it("should remove .bin command from _ arg", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            const determineOptionSpy = jest
                .spyOn(DetermineOptions, "default")
                .mockResolvedValue(defaultOptions);
            // @ts-expect-error this is typed to never, but we want to mock it
            jest.spyOn(Exit, "default").mockImplementation(() => {});
            jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({
                _: ["/Some/Path/To/.bin/checksync", "somethingelse"],
            } as any);

            // Act
            await run(__filename);

            // Assert
            expect(determineOptionSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    _: ["somethingelse"],
                }),
                expect.any(Object),
            );
        });

        it("should remove symlinked launch file from _ arg", async () => {
            // Arrange
            jest.spyOn(CheckSync, "default").mockResolvedValue(0);
            const determineOptionSpy = jest
                .spyOn(DetermineOptions, "default")
                .mockResolvedValue(defaultOptions);
            // @ts-expect-error this is typed to never, but we want to mock it
            jest.spyOn(Exit, "default").mockImplementation(() => {});
            jest.spyOn(ParseArgs, "parseArgs").mockResolvedValue({
                _: ["/usr/local/bin/checksync", "somethingelse"],
            } as any);
            jest.spyOn(fs, "realpathSync").mockImplementation((path: any) =>
                path === "/usr/local/bin/checksync" ? __filename : path,
            );

            // Act
            await run(__filename);

            // Assert
            expect(determineOptionSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    _: ["somethingelse"],
                }),
                expect.any(Object),
            );
        });
    });
});
