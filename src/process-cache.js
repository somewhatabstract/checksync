// @flow
import cwdRelativePath from "./cwd-relative-path.js";
import ErrorCodes from "./error-codes.js";
import validateAndFix from "./validate-and-fix.js";
import validateAndReport from "./validate-and-report.js";

import type {ErrorCode} from "./error-codes.js";
import type {MarkerCache, ILog} from "./types";

export default async function processCache(
    cache: MarkerCache,
    autoFix: boolean,
    log: ILog,
): Promise<ErrorCode> {
    const violationFileNames: Array<string> = [];
    const fileValidator = autoFix ? validateAndFix : validateAndReport;
    for (const file of Object.keys(cache)) {
        if (!(await fileValidator(file, cache, log))) {
            violationFileNames.push(file);
        }
    }

    if (violationFileNames.length > 0) {
        if (autoFix) {
            // Output a summary of what we fixed.
            log.info(`Fixed ${violationFileNames.length} file(s)`);
        } else {
            // Output how to fix any violations we found if we're not running
            // autofix.
            const errorMsg = log.errorsLogged
                ? "🛑  Desynchronized blocks detected and parsing errors found. Fix the errors, update the blocks, then update the sync-start tags using:"
                : "🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:";
            log.group(`\n${errorMsg}`);
            // TODO(somewhatabstract): Add the `--comments` arg to this call.
            log.log(
                `checksync -u ${violationFileNames
                    .map(cwdRelativePath)
                    .join(" ")}`,
            );
            log.groupEnd();
            return ErrorCodes.DESYNCHRONIZED_BLOCKS;
        }
    }

    log.log("🎉  Everything is in sync!");
    return ErrorCodes.SUCCESS;
}
