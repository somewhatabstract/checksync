import Logger from "../logger";
import FileReferenceLogger from "../file-reference-logger";
import maybeReportError from "../maybe-report-error";
import {ErrorCode} from "../error-codes";

describe("#maybeReportError", () => {
    it("should not report a fixable error", () => {
        // Arrange
        const NullPositionLogger = new FileReferenceLogger(
            "FILE",
            new Logger(),
        );
        const errorSpy = jest.spyOn(NullPositionLogger, "error");
        const error = {
            markerID: "MARKER_ID",
            code: ErrorCode.mismatchedChecksum,
            reason: "test error",
            fix: {
                type: "replace",
                line: 100,
                text: "NEW TEXT",
                description: "DESCRIPTION",
                declaration: "OLD TEXT",
            },
        } as const;

        // Act
        maybeReportError(NullPositionLogger, error);

        // Assert
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it.each(Object.values(ErrorCode))(
        "should report non-fixable error %s with log.error",
        (code) => {
            // Arrange
            const NullPositionLogger = new FileReferenceLogger(
                "FILE",
                new Logger(),
            );
            const logSpy = jest.spyOn(NullPositionLogger, "error");
            const error = {
                markerID: "MARKER_ID",
                code,
                location: {
                    line: 100,
                },
                reason: "test error",
            } as const;

            // Act
            maybeReportError(NullPositionLogger, error);

            // Assert
            expect(logSpy).toHaveBeenCalledWith("test error", 100);
        },
    );
});
