// @flow
import cwdRelativePath from "./cwd-relative-path.js";
import Format from "./format.js";
import validateAndFix from "./validate-and-fix.js";
import validateAndJson from "./validate-and-json.js";
import validateAndReport from "./validate-and-report.js";
import outputJson from "./output-json.js";
import outputText from "./output-text.js";

import type {ErrorCode} from "./error-codes.js";
import type {MarkerCache, ILog, Options, JsonItem} from "./types";

type Validator = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
) => Promise<void>;

export default async function processCache(
    options: Options,
    cache: $ReadOnly<MarkerCache>,
    log: ILog,
): Promise<ErrorCode> {
    const {autoFix, json} = options;
    const violationFileNames: Array<string> = [];
    const jsonItems: Array<JsonItem> = [];

    const getValidator = (): Validator => {
        if (options.json) {
            return async (options, file, cache) => {
                jsonItems.push(...validateAndJson(options, file, cache));
            };
        }
        const fileValidator = autoFix ? validateAndFix : validateAndReport;
        return async (options, file, cache) => {
            if (!(await fileValidator(options, file, cache, log))) {
                violationFileNames.push(file);
            }
        };
    };

    const validator = getValidator();

    for (const file of Object.keys(cache)) {
        try {
            await validator(options, file, cache);
        } catch (e) {
            log.error(
                `${Format.cwdFilePath(
                    cwdRelativePath(file),
                )} update encountered error: ${e.message}`,
            );
        }
    }

    if (json) {
        return outputJson(log, jsonItems);
    }

    return outputText(options, violationFileNames, log);
}
