// @flow
import Logger from "../logger.js";
import OutputSink from "../output-sink.js";
import defaultOptions from "../default-options.js";
import {errorCodes} from "../error-codes.js";

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
            outputSink.startFile("foo.js");
            outputSink.processError({
                reason: "REASON",
                code: errorCodes.couldNotParse,
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
                    code: errorCodes.couldNotParse,
                });

            // Assert
            expect(underTest).toThrowErrorMatchingInlineSnapshot(
                `"Cannot process errors before file processing has started"`,
            );
        });

        describe("when options.json = false", () => {
            it("should call maybeReportError with error if json option not set", () => {});

            describe("when error has a fix", () => {
                describe("options.autoFix = false", () => {
                    it("should log mismatches with log.mismatch", () => {});

                    it("should log other errors with log.warn", () => {});
                });

                describe("options.autoFix = true", () => {
                    it("should not log mismatches with log.mismatch", () => {});

                    it("should not log other errors with log.warn", () => {});
                });
            });
        });

        describe("when options.json = true", () => {
            it("should not call maybeReportError with error if json option is set", () => {});

            it("should not log mismatches with log.mismatch", () => {});

            it("should not log other errors with log.warn", () => {});
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
    });

    describe("#end", () => {});
});
