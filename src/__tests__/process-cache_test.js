// @flow
import processCache from "../process-cache.js";
import Logger from "../logger.js";
import ExitCodes from "../exit-codes.js";
import * as OutputSink from "../output-sink.js";
import * as GenerateErrorsForFile from "../generate-errors-for-file.js";

import type {MarkerCache, ErrorDetails, Options} from "../types.js";

jest.mock("../get-launch-string.js", () => () => "checksync");
jest.mock("../output-sink.js");
jest.mock("../generate-errors-for-file.js");

const NullLogger = new Logger(null);

describe("#processCache", () => {
    it("should create a new OutputSink", () => {
        // Arrange
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {};
        const outputSinkSpy = jest.spyOn(OutputSink, "default");

        // Act
        processCache(options, markerCache, NullLogger);

        // Assert
        expect(outputSinkSpy).toHaveBeenCalledWith(options, NullLogger);
    });

    it("should call outputSink.startFile for each file", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetails: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetails],
            },
            filenameb: {
                readOnly: false,
                aliases: ["filenameb"],
                markers: {},
                errors: [errorDetails],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn(),
            endFile: jest.fn(),
            end: jest.fn(),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(
            function* (_, file, cache) {
                yield* cache[file];
            },
        );

        // Act
        await processCache(options, markerCache, NullLogger);

        // Assert
        expect(fakeOutputSink.startFile).toHaveBeenCalledWith("filenamea");
        expect(fakeOutputSink.startFile).toHaveBeenCalledWith("filenameb");
    });

    it("should call outputSink.processError for each error returned by generateErrorsForFile", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetailsA: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const errorDetailsB: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetailsA, errorDetailsB],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn(),
            endFile: jest.fn(),
            end: jest.fn(),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(
            function* (_, file, cache) {
                yield* cache[file].errors;
            },
        );

        // Act
        await processCache(options, markerCache, NullLogger);

        // Assert
        expect(fakeOutputSink.processError).toHaveBeenCalledWith(errorDetailsA);
        expect(fakeOutputSink.processError).toHaveBeenCalledWith(errorDetailsB);
    });

    it("should log error if outputSink.processError throws", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetailsA: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const errorDetailsB: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetailsA, errorDetailsB],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn().mockImplementation(() => {
                throw new Error("Boom!");
            }),
            endFile: jest.fn(),
            end: jest.fn(),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(
            function* (_, file, cache) {
                yield* cache[file].errors;
            },
        );
        const logSpy = jest.spyOn(NullLogger, "error");

        // Act
        await processCache(options, markerCache, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringMatching(
                "filenamea update encountered error: Error: Boom!.*",
            ),
        );
    });

    it("should log error if generateErrorsForFile throws", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetailsA: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const errorDetailsB: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetailsA, errorDetailsB],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn(),
            endFile: jest.fn(),
            end: jest.fn(),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(() => {
            throw new Error("Boom!");
        });
        const logSpy = jest.spyOn(NullLogger, "error");

        // Act
        await processCache(options, markerCache, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringMatching(
                "filenamea update encountered error: Error: Boom!.*",
            ),
        );
    });

    it("should call outputSink.endFile on error", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetailsA: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const errorDetailsB: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetailsA, errorDetailsB],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn(),
            endFile: jest.fn(),
            end: jest.fn(),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(() => {
            throw new Error("Boom!");
        });

        // Act
        await processCache(options, markerCache, NullLogger);

        // Assert
        expect(fakeOutputSink.endFile).toHaveBeenCalled();
    });

    it("should call outputSink.endFile on success", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetailsA: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const errorDetailsB: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetailsA, errorDetailsB],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn(),
            endFile: jest.fn(),
            end: jest.fn(),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(
            function* (_, file, cache) {
                yield* cache[file].errors;
            },
        );

        // Act
        await processCache(options, markerCache, NullLogger);

        // Assert
        expect(fakeOutputSink.endFile).toHaveBeenCalled();
    });

    it("should return result of outputSink.end", async () => {
        // Arrange
        const options: Options = ({}: any);
        const errorDetailsA: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const errorDetailsB: ErrorDetails = ({
            code: "fake-error",
            reason: "We are testing!",
        }: any);
        const markerCache: MarkerCache = {
            filenamea: {
                readOnly: false,
                aliases: ["filenamea"],
                markers: {},
                errors: [errorDetailsA, errorDetailsB],
            },
        };
        const fakeOutputSink = {
            startFile: jest.fn(),
            processError: jest.fn(),
            endFile: jest.fn(),
            end: jest.fn().mockReturnValue(ExitCodes.CATASTROPHIC),
        };
        jest.spyOn(OutputSink, "default").mockImplementation(
            () => fakeOutputSink,
        );
        jest.spyOn(GenerateErrorsForFile, "default").mockImplementation(
            function* (_, file, cache) {
                yield* cache[file].errors;
            },
        );

        // Act
        const result = await processCache(options, markerCache, NullLogger);

        // Assert
        expect(result).toBe(ExitCodes.CATASTROPHIC);
    });
});
