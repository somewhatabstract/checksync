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
    const violationFileNames: Array<string> = [];
    const jsonItems: Array<JsonItem> = [];

    const validator = getValidator(options, jsonItems);

    for (const file of Object.keys(cache)) {
        try {
            if (!(await validator(options, file, cache, log))) {
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

    const output = getOutput(options);

    return output(options, log, jsonItems, violationFileNames);
}
