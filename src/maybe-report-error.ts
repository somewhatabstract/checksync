import {ErrorDetails, IPositionLog} from "./types";

/**
 * Maybe report an error to the log.
 *
 * @param {IPositionLog} log The log for recording errors.
 * @param {ErrorDetails} error The error to be reported.
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
    log.error(error.reason, error.location?.line);
}
