import Logger from "../logger";
import StringLogger from "../string-logger";
import OutputSink from "../output-sink";
import defaultOptions from "../default-options";
import {ErrorCode} from "../error-codes";
import {ExitCode} from "../exit-codes";
import * as MaybeReportError from "../maybe-report-error";
import * as FileReferenceLogger from "../file-reference-logger";
import * as FixFile from "../fix-file";
import * as GetLaunchString from "../get-launch-string";

import {ErrorDetails} from "../types";

jest.mock("../maybe-report-error");
jest.mock("../file-reference-logger");
jest.mock("../fix-file");
jest.mock("../get-launch-string");

describe("OutputSink", () => {
    describe("#startFile", () => {
        it("should not throw if a file has not been started and it has not already been drained", () => {
            // Arrange
            const NullLogger = new Logger();
            const outputSink = new OutputSink(defaultOptions, NullLogger);

            // Act
            const underTest = () => outputSink.startFile("file.js");

            // Assert
            expect(underTest).not.toThrow();
        });

        it("should throw if a file has already been started", () => {
            // Arrange
            const NullLogger = new Logger();
            const outputSink = new OutputSink(defaultOptions, NullLogger);
            outputSink.startFile("foo.js");

            // Act
            const underTest = () => outputSink.startFile("foo.js");

            // Assert
            expect(underTest).toThrowErrorMatchingInlineSnapshot(
                `"Cannot start processing a file while already processing another"`,
            );
        });

        it("should throw if the file has already been drained to the output sink", async () => {
            // Arrange
            const NullLogger = new Logger();
            const outputSink = new OutputSink(defaultOptions, NullLogger);
            jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                () =>
                    ({
                        file: "foo.js",
                    }) as any,
            );
            outputSink.startFile("foo.js");
            outputSink.processError({
                reason: "REASON",
                code: ErrorCode.couldNotParse,
            });
            await outputSink.endFile();

            // Act
            const underTest = () => outputSink.startFile("foo.js");

            // Assert
            expect(underTest).toThrowErrorMatchingInlineSnapshot(
                `"File has already been drained to the output sink"`,
            );
        });
    });

    describe("#processError", () => {
        it("should throw if a file hasn't been started", () => {
            // Arrange
            const NullLogger = new Logger();
            const outputSink = new OutputSink(defaultOptions, NullLogger);

            // Act
            const underTest = () =>
                outputSink.processError({
                    reason: "REASON",
                    code: ErrorCode.couldNotParse,
                });

            // Assert
            expect(underTest).toThrowErrorMatchingInlineSnapshot(
                `"Cannot process errors before file processing has started"`,
            );
        });

        describe("when options.json = false", () => {
            it("should call maybeReportError with error if json option not set", () => {
                // Arrange
                const NullLogger = new Logger();
                const options = {
                    ...defaultOptions,
                    json: false,
                } as const;
                const dummyFileLogger: any = {
                    file: "foo.js",
                } as const;
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    () => dummyFileLogger,
                );
                const outputSink = new OutputSink(options, NullLogger);
                const reportSpy = jest.spyOn(MaybeReportError, "default");
                const errorDetails: ErrorDetails = {
                    reason: "REASON",
                    code: ErrorCode.couldNotParse,
                };
                outputSink.startFile("foo.js");

                // Act
                outputSink.processError(errorDetails);

                // Assert
                expect(reportSpy).toHaveBeenCalledWith(
                    dummyFileLogger,
                    errorDetails,
                );
            });

            describe("when error has a fix", () => {
                describe("options.autoFix = false", () => {
                    it("should log mismatches with log.mismatch", () => {
                        // Arrange
                        const NullLogger = new Logger();
                        const options = {
                            ...defaultOptions,
                            json: false,
                            autoFix: false,
                        } as const;
                        const dummyFileLogger: any = {
                            file: "foo.js",
                            mismatch: jest.fn<any, any>(),
                        } as const;
                        jest.spyOn(
                            FileReferenceLogger,
                            "default",
                        ).mockImplementation(() => dummyFileLogger);
                        const outputSink = new OutputSink(options, NullLogger);
                        const errorDetails: ErrorDetails = {
                            reason: "REASON",
                            code: ErrorCode.mismatchedChecksum,
                            fix: {
                                type: "replace",
                                line: 1,
                                text: "TEXT",
                                description: "DESCRIPTION",
                                declaration: "DECLARATION",
                            },
                        };
                        outputSink.startFile("foo.js");

                        // Act
                        outputSink.processError(errorDetails);

                        // Assert
                        expect(dummyFileLogger.mismatch).toHaveBeenCalledWith(
                            "REASON",
                            1,
                        );
                    });

                    it.each(
                        Object.values(ErrorCode).filter(
                            (e) => e !== ErrorCode.mismatchedChecksum,
                        ),
                    )("should log %s errors with log.warn", (code) => {
                        // Arrange
                        const NullLogger = new Logger();
                        const options = {
                            ...defaultOptions,
                            json: false,
                            autoFix: false,
                        } as const;
                        const dummyFileLogger: any = {
                            file: "foo.js",
                            warn: jest.fn<any, any>(),
                        } as const;
                        jest.spyOn(
                            FileReferenceLogger,
                            "default",
                        ).mockImplementation(() => dummyFileLogger);
                        const outputSink = new OutputSink(options, NullLogger);
                        const errorDetails: ErrorDetails = {
                            reason: "REASON",
                            code,
                            fix: {
                                type: "replace",
                                line: 1,
                                text: "TEXT",
                                description: "DESCRIPTION",
                                declaration: "DECLARATION",
                            },
                        };
                        outputSink.startFile("foo.js");

                        // Act
                        outputSink.processError(errorDetails);

                        // Assert
                        expect(dummyFileLogger.warn).toHaveBeenCalledWith(
                            "REASON",
                            1,
                        );
                    });
                });

                describe("options.autoFix = true", () => {
                    it.each(Object.values(ErrorCode))(
                        "should not log %s errors with log.mismatch",
                        (code) => {
                            // Arrange
                            const NullLogger = new Logger();
                            const options = {
                                ...defaultOptions,
                                json: false,
                                autoFix: true,
                            } as const;
                            const dummyFileLogger: any = {
                                file: "foo.js",
                                mismatch: jest.fn<any, any>(),
                            } as const;
                            jest.spyOn(
                                FileReferenceLogger,
                                "default",
                            ).mockImplementation(() => dummyFileLogger);
                            const outputSink = new OutputSink(
                                options,
                                NullLogger,
                            );
                            const errorDetails: ErrorDetails = {
                                reason: "REASON",
                                code,
                                fix: {
                                    type: "replace",
                                    line: 1,
                                    text: "TEXT",
                                    description: "DESCRIPTION",
                                    declaration: "DECLARATION",
                                },
                            };
                            outputSink.startFile("foo.js");

                            // Act
                            outputSink.processError(errorDetails);

                            // Assert
                            expect(
                                dummyFileLogger.mismatch,
                            ).not.toHaveBeenCalled();
                        },
                    );

                    it.each(Object.values(ErrorCode))(
                        "should not log %s errors with log.warn",
                        (code) => {
                            // Arrange
                            const NullLogger = new Logger();
                            const options = {
                                ...defaultOptions,
                                json: false,
                                autoFix: true,
                            } as const;
                            const dummyFileLogger: any = {
                                file: "foo.js",
                                warn: jest.fn<any, any>(),
                            } as const;
                            jest.spyOn(
                                FileReferenceLogger,
                                "default",
                            ).mockImplementation(() => dummyFileLogger);
                            const outputSink = new OutputSink(
                                options,
                                NullLogger,
                            );
                            const errorDetails: ErrorDetails = {
                                reason: "REASON",
                                code,
                                fix: {
                                    type: "replace",
                                    line: 1,
                                    text: "TEXT",
                                    description: "DESCRIPTION",
                                    declaration: "DECLARATION",
                                },
                            };
                            outputSink.startFile("foo.js");

                            // Act
                            outputSink.processError(errorDetails);

                            // Assert
                            expect(dummyFileLogger.warn).not.toHaveBeenCalled();
                        },
                    );
                });
            });
        });

        describe("when options.json = true", () => {
            it("should not call maybeReportError with error if json option is set", () => {
                // Arrange
                const NullLogger = new Logger();
                const options = {
                    ...defaultOptions,
                    json: true,
                } as const;
                const dummyFileLogger: any = {
                    file: "foo.js",
                } as const;
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    () => dummyFileLogger,
                );
                const outputSink = new OutputSink(options, NullLogger);
                const reportSpy = jest.spyOn(MaybeReportError, "default");
                const errorDetails: ErrorDetails = {
                    reason: "REASON",
                    code: ErrorCode.couldNotParse,
                };
                outputSink.startFile("foo.js");

                // Act
                outputSink.processError(errorDetails);

                // Assert
                expect(reportSpy).not.toHaveBeenCalled();
            });

            it.each(Object.values(ErrorCode))(
                "should not log %s errors with log.mismatch",
                (code) => {
                    // Arrange
                    const NullLogger = new Logger();
                    const options = {
                        ...defaultOptions,
                        json: true,
                    } as const;
                    const dummyFileLogger: any = {
                        file: "foo.js",
                        mismatch: jest.fn<any, any>(),
                    } as const;
                    jest.spyOn(
                        FileReferenceLogger,
                        "default",
                    ).mockImplementation(() => dummyFileLogger);
                    const outputSink = new OutputSink(options, NullLogger);
                    const errorDetails: ErrorDetails = {
                        reason: "REASON",
                        code,
                        fix: {
                            type: "replace",
                            line: 1,
                            text: "TEXT",
                            description: "DESCRIPTION",
                            declaration: "DECLARATION",
                        },
                    };
                    outputSink.startFile("foo.js");

                    // Act
                    outputSink.processError(errorDetails);

                    // Assert
                    expect(dummyFileLogger.mismatch).not.toHaveBeenCalled();
                },
            );

            it.each(Object.values(ErrorCode))(
                "should not log %s errors with log.warn",
                (code) => {
                    // Arrange
                    const NullLogger = new Logger();
                    const options = {
                        ...defaultOptions,
                        json: true,
                    } as const;
                    const dummyFileLogger: any = {
                        file: "foo.js",
                        warn: jest.fn<any, any>(),
                    } as const;
                    jest.spyOn(
                        FileReferenceLogger,
                        "default",
                    ).mockImplementation(() => dummyFileLogger);
                    const outputSink = new OutputSink(options, NullLogger);
                    const errorDetails: ErrorDetails = {
                        reason: "REASON",
                        code,
                        fix: {
                            type: "replace",
                            line: 1,
                            text: "TEXT",
                            description: "DESCRIPTION",
                            declaration: "DECLARATION",
                        },
                    };
                    outputSink.startFile("foo.js");

                    // Act
                    outputSink.processError(errorDetails);

                    // Assert
                    expect(dummyFileLogger.warn).not.toHaveBeenCalled();
                },
            );
        });
    });

    describe("#endFile", () => {
        it("should throw if a file hasn't been started", async () => {
            // Arrange
            const NullLogger = new Logger();
            const outputSink = new OutputSink(defaultOptions, NullLogger);

            // Act
            const underTest = outputSink.endFile();

            // Assert
            await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
                `"Cannot end processing a file before file processing has started"`,
            );
        });

        it("should remove errorless files from results", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            const outputSink = new OutputSink(
                {...defaultOptions, json: true},
                NullLogger,
            );
            const dummyFileLogger: any = {
                file: "foo.js",
            } as const;
            jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                () => dummyFileLogger,
            );
            outputSink.startFile("foo.js");

            // Act
            await outputSink.endFile();
            outputSink.end();

            // Assert
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('"files": {}'),
            );
        });

        it("should call fixFile with fixes when autoFix is true and there are no unfixable errors", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options = {
                ...defaultOptions,
                autoFix: true,
            } as const;
            const dummyFileLogger: any = {
                file: "foo.js",
                verbose: jest.fn<any, any>(),
            } as const;
            jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                () => dummyFileLogger,
            );
            const fixFileSpy = jest.spyOn(FixFile, "default");
            const outputSink = new OutputSink(options, NullLogger);
            const errorDetails: ErrorDetails = {
                reason: "REASON",
                code: ErrorCode.duplicateTarget,
                fix: {
                    type: "replace",
                    line: 1,
                    text: "TEXT",
                    description: "DESCRIPTION",
                    declaration: "DECLARATION",
                },
            };
            outputSink.startFile("foo.js");
            outputSink.processError(errorDetails);

            // Act
            await outputSink.endFile();

            // Assert
            expect(fixFileSpy).toHaveBeenCalledWith(
                options,
                "foo.js",
                dummyFileLogger,
                {
                    DECLARATION: [errorDetails],
                },
            );
        });

        it("should not call fixFile when autoFix is true and there are unfixable errors", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options = {
                ...defaultOptions,
                autoFix: true,
            } as const;
            const dummyFileLogger: any = {
                file: "foo.js",
            } as const;
            jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                () => dummyFileLogger,
            );
            const fixFileSpy = jest.spyOn(FixFile, "default");
            const outputSink = new OutputSink(options, NullLogger);
            const unfixableError: ErrorDetails = {
                reason: "REASON",
                code: ErrorCode.couldNotParse,
            };
            const fixableError: ErrorDetails = {
                reason: "REASON",
                code: ErrorCode.duplicateTarget,
                fix: {
                    type: "replace",
                    line: 1,
                    text: "TEXT",
                    description: "DESCRIPTION",
                    declaration: "DECLARATION",
                },
            };
            outputSink.startFile("foo.js");
            outputSink.processError(unfixableError);
            outputSink.processError(fixableError);

            // Act
            await outputSink.endFile();

            // Assert
            expect(fixFileSpy).not.toHaveBeenCalled();
        });

        it("should not call fixFile when autoFix is false", async () => {
            // Arrange
            const NullLogger = new Logger();
            const options = {
                ...defaultOptions,
                autoFix: false,
            } as const;
            const dummyFileLogger: any = {
                file: "foo.js",
                warn: jest.fn<any, any>(),
            } as const;
            jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                () => dummyFileLogger,
            );
            const fixFileSpy = jest.spyOn(FixFile, "default");
            const outputSink = new OutputSink(options, NullLogger);
            const fixableError: ErrorDetails = {
                reason: "REASON",
                code: ErrorCode.duplicateTarget,
                fix: {
                    type: "replace",
                    line: 1,
                    text: "TEXT",
                    description: "DESCRIPTION",
                    declaration: "DECLARATION",
                },
            };
            outputSink.startFile("foo.js");
            outputSink.processError(fixableError);

            // Act
            await outputSink.endFile();

            // Assert
            expect(fixFileSpy).not.toHaveBeenCalled();
        });
    });

    describe("#end", () => {
        describe("options.json is true", () => {
            it("should output JSON", () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {...defaultOptions, json: true},
                    NullLogger,
                );

                // Act
                outputSink.end();
                const output = logSpy.mock.calls[0][0];
                const act = () => JSON.parse(output);

                // Assert
                expect(act).not.toThrow();
            });

            it("should output the tool version that generated the file", async () => {
                // Arrange
                const {
                    default: {version},
                } = await import("../../package.json");
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {...defaultOptions, json: true},
                    NullLogger,
                );

                // Act
                outputSink.end();
                const result = JSON.parse(logSpy.mock.calls[0][0]);

                // Assert
                expect(result).toHaveProperty("version", version);
            });

            it("should include the launch string for autofixing", () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {...defaultOptions, json: true},
                    NullLogger,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "I AM THE LAUNCH STRING!",
                );

                // Act
                outputSink.end();
                const result = JSON.parse(logSpy.mock.calls[0][0]);

                // Assert
                expect(result).toHaveProperty(
                    "launchString",
                    "I AM THE LAUNCH STRING! -u ",
                );
            });

            it("should add comments to launch string if comments option is non-default", () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                        comments: ["#", "//", "DOOBEEDOO"],
                    },
                    NullLogger,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "LAUNCHBASE",
                );

                // Act
                outputSink.end();
                const result = JSON.parse(logSpy.mock.calls[0][0]);

                // Assert
                expect(result).toHaveProperty(
                    "launchString",
                    'LAUNCHBASE -c "# // DOOBEEDOO" -u ',
                );
            });

            it("should add root marker to launch string if root marker option specified", () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                        rootMarker: "ROOT",
                    },
                    NullLogger,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "LAUNCHBASE",
                );

                // Act
                outputSink.end();
                const result = JSON.parse(logSpy.mock.calls[0][0]);

                // Assert
                expect(result).toHaveProperty(
                    "launchString",
                    'LAUNCHBASE -m "ROOT" -u ',
                );
            });

            it("should add file names of fixable files to launch string if there are any", async () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                    },
                    NullLogger,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "LAUNCHBASE",
                );
                outputSink.startFile("foo.js");
                outputSink.processError({
                    reason: "REASON",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                });
                await outputSink.endFile();
                outputSink.startFile("bar.js");
                outputSink.processError({
                    reason: "REASON",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_B",
                        description: "DESCRIPTION_B",
                        declaration: "DECLARATION_B",
                    },
                });
                await outputSink.endFile();

                // Act
                outputSink.end();
                const result = JSON.parse(logSpy.mock.calls[0][0]);

                // Assert
                expect(result).toHaveProperty(
                    "launchString",
                    "LAUNCHBASE -u foo.js bar.js",
                );
            });

            it("should output the files and their errors", async () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {...defaultOptions, json: true},
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.couldNotParse,
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();
                outputSink.startFile("bar.js");
                const errorB1 = {
                    reason: "REASON_B1",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_B1",
                        description: "DESCRIPTION_B1",
                        declaration: "DECLARATION_B1",
                    },
                } as const;
                outputSink.processError(errorB1);
                const errorB2 = {
                    reason: "REASON_B2",
                    code: ErrorCode.duplicateTarget,
                    location: {
                        line: 42,
                        startColumn: 1,
                        endColumn: 10,
                    },
                    fix: {
                        type: "replace",
                        line: 42,
                        text: "TEXT_B2",
                        description: "DESCRIPTION_B2",
                        declaration: "DECLARATION_B2",
                    },
                } as const;
                outputSink.processError(errorB2);
                await outputSink.endFile();

                // Act
                outputSink.end();
                const {files: result} = JSON.parse(logSpy.mock.calls[0][0]);

                // Assert
                expect(result).toStrictEqual({
                    "foo.js": [errorA],
                    "bar.js": [errorB1, errorB2],
                });
            });

            it("should log error that there are unfixable errors and autofix is true", async () => {
                // Arrange
                const NullLogger = new Logger();
                const errorSpy = jest.spyOn(NullLogger, "error");
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                        autoFix: true,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.couldNotParse,
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                outputSink.end();

                // Assert
                expect(errorSpy).toHaveBeenCalledWith(
                    "🛑  Could not update all tags due to unfixable errors. Fix the errors and try again.",
                );
            });

            it("should return ExitCode.PARSE_ERRORS when there are unfixable errors", async () => {
                // Arrange
                const NullLogger = new Logger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.couldNotParse,
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.PARSE_ERRORS);
            });

            it("should return ExitCode.DESYNCHRONIZED_BLOCKS if there are fixable files and autoFix is false", async () => {
                // Arrange
                const NullLogger = new Logger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.DESYNCHRONIZED_BLOCKS);
            });

            it("should return ExitCode.SUCCESS if all errors are fixed", async () => {
                // Arrange
                const NullLogger = new Logger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            verbose: jest.fn<any, any>(),
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                        autoFix: true,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.SUCCESS);
            });

            it("should return ExitCode.SUCCESS if there are no errors", () => {
                // Arrange
                const NullLogger = new Logger();
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: true,
                        autoFix: true,
                    },
                    NullLogger,
                );

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.SUCCESS);
            });
        });

        describe("options.json is false", () => {
            it("should log error if there are fixable and unfixable errors and autoFix is false", () => {
                // Arrange
                const logger = new StringLogger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            warn: jest.fn<any, any>(),
                        }) as any,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "LAUNCHSTRING",
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: false,
                    },
                    logger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.couldNotParse,
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                outputSink.endFile();
                const errorB1 = {
                    reason: "REASON_B",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("bar.js");
                outputSink.processError(errorB1);
                outputSink.endFile();

                // Act
                outputSink.end();
                const result = logger.getLog();

                // Assert
                expect(result).toMatchInlineSnapshot(`
                    "
                    <group 🛑  Desynchronized blocks detected and parsing errors were found. Fix the errors, update the blocks, then update the sync-start tags using: >

                      LAUNCHSTRING -u bar.js
                    <end_group>

                    <group 🛑  Unfixable errors found. Fix the errors in these files and try again. >
                      foo.js
                    <end_group>"
                `);
            });

            it("should log dry run message if there are fixable errors, options.autoFix is true, but options.dryRun is true", async () => {
                // Arrange
                const logger = new StringLogger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            warn: jest.fn<any, any>(),
                            verbose: jest.fn<any, any>(),
                        }) as any,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "LAUNCHSTRING",
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: true,
                        dryRun: true,
                    },
                    logger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                outputSink.end();
                const result = logger.getLog();

                // Assert
                expect(result).toMatchInlineSnapshot(`
                    "
                    <group 1 file(s) would have been fixed.
                    To fix, run: >
                      LAUNCHSTRING -u foo.js
                    <end_group>
                    🎉  Everything is in sync!"
                `);
            });

            it("should log if there are fixable errors and autoFix is false", () => {
                // Arrange
                const logger = new StringLogger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            warn: jest.fn<any, any>(),
                            mismatch: jest.fn<any, any>(),
                        }) as any,
                );
                jest.spyOn(GetLaunchString, "default").mockReturnValue(
                    "LAUNCHSTRING",
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: false,
                    },
                    logger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.mismatchedChecksum,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                outputSink.endFile();
                const errorB1 = {
                    reason: "REASON_B",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_B",
                        description: "DESCRIPTION_B",
                        declaration: "DECLARATION_B",
                    },
                } as const;
                outputSink.startFile("bar.js");
                outputSink.processError(errorB1);
                outputSink.endFile();

                // Act
                outputSink.end();
                const result = logger.getLog();

                // Assert
                expect(result).toMatchInlineSnapshot(`
                    "
                    <group 🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing: >

                      LAUNCHSTRING -u foo.js bar.js
                    <end_group>"
                `);
            });

            it("should output success text all errors are fixed", async () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: true,
                    },
                    NullLogger,
                );
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            warn: jest.fn<any, any>(),
                            verbose: jest.fn<any, any>(),
                        }) as any,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                outputSink.end();

                // Assert
                expect(logSpy).toHaveBeenCalledWith(
                    "🎉  Everything is in sync!",
                );
            });

            it("should output success text if there are no errors", () => {
                // Arrange
                const NullLogger = new Logger();
                const logSpy = jest.spyOn(NullLogger, "log");
                const outputSink = new OutputSink(
                    {...defaultOptions, json: false},
                    NullLogger,
                );

                // Act
                outputSink.end();

                // Assert
                expect(logSpy).toHaveBeenCalledWith(
                    "🎉  Everything is in sync!",
                );
            });

            it("should log error that there are unfixable errors and autofix is true", async () => {
                // Arrange
                const logger = new StringLogger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: true,
                    },
                    logger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.couldNotParse,
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                outputSink.end();
                const result = logger.getLog();

                // Assert
                expect(result).toMatchInlineSnapshot(`
                    "
                    <group 🛑  Could not update all tags due to unfixable errors. Fix the errors in these files and try again. >
                      foo.js
                    <end_group>"
                `);
            });

            it("should return ExitCode.PARSE_ERRORS when there are unfixable errors", async () => {
                // Arrange
                const NullLogger = new Logger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.couldNotParse,
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.PARSE_ERRORS);
            });

            it("should return ExitCode.DESYNCHRONIZED_BLOCKS if there are fixable files and autoFix is false", async () => {
                // Arrange
                const NullLogger = new Logger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            warn: jest.fn<any, any>(),
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.DESYNCHRONIZED_BLOCKS);
            });

            it("should return ExitCode.SUCCESS if all errors are fixed", async () => {
                // Arrange
                const NullLogger = new Logger();
                jest.spyOn(FileReferenceLogger, "default").mockImplementation(
                    (file) =>
                        ({
                            file,
                            verbose: jest.fn<any, any>(),
                        }) as any,
                );
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: true,
                    },
                    NullLogger,
                );
                const errorA = {
                    reason: "REASON_A",
                    code: ErrorCode.duplicateTarget,
                    fix: {
                        type: "replace",
                        line: 1,
                        text: "TEXT_A",
                        description: "DESCRIPTION_A",
                        declaration: "DECLARATION_A",
                    },
                } as const;
                outputSink.startFile("foo.js");
                outputSink.processError(errorA);
                await outputSink.endFile();

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.SUCCESS);
            });

            it("should return ExitCode.SUCCESS if there are no errors", () => {
                // Arrange
                const NullLogger = new Logger();
                const outputSink = new OutputSink(
                    {
                        ...defaultOptions,
                        json: false,
                        autoFix: true,
                    },
                    NullLogger,
                );

                // Act
                const result = outputSink.end();

                // Assert
                expect(result).toBe(ExitCode.SUCCESS);
            });
        });
    });
});
