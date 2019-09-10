// @flow
import path from "path";

import getMarkersFromFiles from "./get-markers-from-files.js";
import getFiles from "./get-files.js";
import Format from "./format.js";
import ErrorCodes from "./error-codes.js";
import handleViolations from "./handle-violations.js";

import type {ILog} from "./types.js";
import type {ErrorCode} from "./error-codes.js";

/**
 * Check the sync marks for the files represented by the given globs.
 *
 * @param {string[]} globs The globs that identify which files to check.
 * @param {boolean} autoFix When true, any out-of-date sync markers will be
 * updated.
 */
export default async function checkSync(
    globs: Array<string>,
    autoFix: boolean,
    comments: Array<string>,
    log: ILog,
): Promise<ErrorCode> {
    const files = await getFiles(globs);

    if (files.length === 0) {
        log.error("No matching files");
        return ErrorCodes.NO_FILES;
    }

    const cache = await getMarkersFromFiles(files, comments, log);

    if (log.errorsLogged && autoFix) {
        log.error(
            "Aborting fix due to parse errors. Fix errors and try again.",
        );
        return ErrorCodes.PARSE_ERRORS;
    }

    const violationFileNames = handleViolations(cache, autoFix, log).map(f =>
        path.relative(process.cwd(), f),
    );
    if (violationFileNames.length > 0) {
        if (autoFix) {
            // Output a summary of what we fixed.
            log.info(`Fixed ${violationFileNames.length} file(s)`);
        } else {
            // Output how to fix any violations we found if we're not running
            // autofix.
            log.group(
                Format.error(
                    "Desynchronized blocks detected. Check them and update as required before resynchronizing:",
                ),
            );
            log.error(`checksync --fix ${violationFileNames.join(" ")}`, true);
            log.groupEnd();
            return ErrorCodes.DESYNCHRONIZED_BLOCKS;
        }
    }
    return ErrorCodes.SUCCESS;
}
