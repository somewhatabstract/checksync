// @flow
import {TargetError, MarkerError} from "./types.js";
import type {EdgeErrorDetails, IPositionLog} from "./types.js";

export default function reportErrors(
    log: IPositionLog,
    errors: $ReadOnlyArray<EdgeErrorDetails>,
): void {
    for (const error of errors) {
        switch (error.code) {
            case TargetError.duplicate:
            case MarkerError.empty:
                log.warn(error.message, error.line);
                break;

            case TargetError.fileDoesNotExist:
            case TargetError.differentCommentSyntax:
            case TargetError.startTagAfterContent:
            case MarkerError.endTagWithoutStartTag:
            case TargetError.malformedStartTag:
            case MarkerError.malformedEndTag:
            case MarkerError.selfTargeting:
            case MarkerError.duplicate:
            default:
                log.error(error.message, error.line);
                break;
        }
        // TODO: log error as warning or error appropriately
    }
}
