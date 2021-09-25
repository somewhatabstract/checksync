// @flow
import Logger from "../logger.js";
import FileReferenceLogger from "../file-reference-logger.js";
import maybeReportError from "../maybe-report-error.js";
import {errorCodes} from "../error-codes.js";

describe("#maybeReportError", () => {
    it("should not report a fixable error", () => {
        // Arrange
        const NullPositionLogger = new FileReferenceLogger(
            "FILE",
            new Logger(),
        );
        const warnSpy = jest.spyOn(NullPositionLogger, "warn");
        const errorSpy = jest.spyOn(NullPositionLogger, "error");
        const error = {
            code: errorCodes.mismatchedChecksum,
            reason: "test error",
            fix: {
                type: "replace",
                line: 100,
                text: "NEW TEXT",
                description: "DESCRIPTION",
                declaration: "OLD TEXT",
            },
        };

        // Act
        maybeReportError(NullPositionLogger, error);

        // Assert
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    const errorCodesToError = Object.values(errorCodes)
        .filter(
            (e) =>
                e !== errorCodes.emptyMarker &&
                e !== errorCodes.endTagWithoutStartTag,
        )
        .map((e) => [e, "error"]);

    it.each(
        [
            [errorCodes.endTagWithoutStartTag, "warn"],
            [errorCodes.emptyMarker, "warn"],
        ].concat(errorCodesToError),
    )("should report non-fixable error %s with log.%s", (code, method) => {
        // Arrange
        const NullPositionLogger = new FileReferenceLogger(
            "FILE",
            new Logger(),
        );
        const logSpy = jest.spyOn(NullPositionLogger, method);
        const error = {
            code,
            location: {
                line: 100,
            },
            reason: "test error",
        };

        // Act
        maybeReportError(NullPositionLogger, error);

        // Assert
        expect(logSpy).toHaveBeenCalledWith("test error", 100);
    });
});
