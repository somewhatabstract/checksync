// @flow
import cwdRelativePath from "./cwd-relative-path.js";
import ErrorCodes from "./error-codes.js";
import Format from "./format.js";
import validateAndFix from "./validate-and-fix.js";
import validateAndReport from "./validate-and-report.js";

import type {ErrorCode} from "./error-codes.js";
import type {MarkerCache, ILog, Options} from "./types";

export default async function processCache(
    options: Options,
    cache: MarkerCache,
    log: ILog,
): Promise<ErrorCode> {
    const {autoFix} = options;
    const violationFileNames: Array<string> = [];
    const fileValidator = autoFix ? validateAndFix : validateAndReport;
    for (const file of Object.keys(cache)) {
        try {
            if (!(await fileValidator(file, options.rootMarker, cache, log))) {
                violationFileNames.push(file);
            }
        } catch (e) {
            log.error(
                `${Format.cwdFilePath(
                    cwdRelativePath(file),
                )} update encountered error: ${e.message}`,
            );
        }
    }

    if (violationFileNames.length > 0) {
        if (autoFix) {
            // Output a summary of what we fixed.
            log.info(`Fixed ${violationFileNames.length} file(s)`);
        } else {
            // Output how to fix any violations we found if we're not running
            // autofix.
            log.log("");
            const errorMsg = log.errorsLogged
                ? "🛑  Desynchronized blocks detected and parsing errors found. Fix the errors, update the blocks, then update the sync-start tags using:"
                : "🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:";
            log.group(`${errorMsg}`);
            const commentsArg = options.comments.join(",");
            const fileNamesArgs = violationFileNames
                .map(cwdRelativePath)
                .join(" ");
            log.log(`checksync -c "${commentsArg}" -u ${fileNamesArgs}`);
            log.groupEnd();
            return ErrorCodes.DESYNCHRONIZED_BLOCKS;
        }
    }

    if (log.errorsLogged) {
        log.log("🛑  Errors occurred during processing");
        return ErrorCodes.PARSE_ERRORS;
    }

    log.log("🎉  Everything is in sync!");
    return ErrorCodes.SUCCESS;
}
