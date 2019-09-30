// @flow
import * as minimist from "minimist";

import {run} from "../cli.js";
import * as CheckSync from "../check-sync.js";
import ErrorCodes from "../error-codes.js";
import Logger from "../logger.js";
import defaultArgs from "../default-args.js";

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
    return function() {
        return log;
    };
});

describe("#run", () => {
    it("should parse args", () => {
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

        // Act
        run(__filename);

        // Arrange
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

        // Arrange
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

        // Arrange
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
            _: ["globs", "and globs"],
        };
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);

        // Act
        run(__filename);

        // Arrange
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
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("/Some/Path/To/.bin/checksync");

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
            run(__filename);
            const thenHandler = thenMock.mock.calls[0][0];

            // Act
            thenHandler(99);

            // Assert
            expect(exitSpy).toHaveBeenCalledWith(99);
        });
    });
});
