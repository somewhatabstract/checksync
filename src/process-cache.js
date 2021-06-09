// @flow
import cwdRelativePath from "./cwd-relative-path.js";
import Format from "./format.js";
import getOutput from "./get-output.js";
import getValidator from "./get-validator.js";

import type {ErrorCode} from "./error-codes.js";
import type {MarkerCache, ILog, Options, JsonItem} from "./types";

export default async function processCache(
    options: Options,
    cache: $ReadOnly<MarkerCache>,
    log: ILog,
): Promise<ErrorCode> {
    const fixableFileNames: Array<string> = [];
    const jsonItems: Array<JsonItem> = [];

    // TODO: Our MarkerCache will shortly have lots of different types of
    // broken data.
    //   - Files that couldn't be parsed
    //   - Duplicate, empty, and untargeted markers
    //   - Marker targets with various issues, including invalid checksums
    //
    // Therefore, our validation code needs to properly handle those issues.
    //  - Validate and fix will want to be able to fix what it can and log
    //    the rest as warnings and errors
    //  - Validate and report will just want to log things as warnings and
    //    errors
    //  - Validate and JSON will want to report everything in the JSON but
    //    likely also log warnings and errors
    //
    // So, to ensure we don't iterate more than is necessary, our edge
    // processing should likely be responsible for logging warnings and errors
    // consistently. When we work out fixes for more types of errors, we would
    // move those out of the "log to warning or error" into the broken edge
    // format that a fixer can then fix up.
    //
    // So:
    //   1. Call broken edge generator
    //   2. Loop over broken edges, passing data to the "fixer"
    //   3. JSON fixer builds/outputs JSON
    //      Regular fixer fixes the files in place
    //      Report just reports

    const validator = getValidator(options, jsonItems);

    for (const file of Object.keys(cache)) {
        try {
            if (!(await validator(options, file, cache, log))) {
                fixableFileNames.push(file);
            }
        } catch (e) {
            log.error(
                `${Format.cwdFilePath(
                    cwdRelativePath(file),
                )} update encountered error: ${e.message}`,
            );
        }
    }

    const output = getOutput(options);

    return output(options, log, jsonItems, fixableFileNames);
}
