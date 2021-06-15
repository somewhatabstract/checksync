// @flow
import ErrorCodes from "./error-codes.js";
import type {ErrorDetails, IPositionLog} from "./types.js";

/**
 * Maybe report an error as a warning or error.
 *
 * @param {IPositionLog} log The log for recording warnings and errors.
 * @param {ErrorDetails} error The error to be reported
 * @returns {void} Nothing
 */
export default function maybeReportError(
    log: IPositionLog,
    error: ErrorDetails,
): void {
    if (error.fix != null) {
        // We don't automatically report things that can be fixed.
        // The fix handler will deal with those.
        return;
    }

    switch (error.code) {
        case ErrorCodes.duplicateTarget:
        case ErrorCodes.emptyMarker:
            log.warn(error.reason, error.location?.line);
            break;

        default:
            log.error(error.reason, error.location?.line);
            break;
    }
}
