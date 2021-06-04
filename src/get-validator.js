// @flow
import validateAndFix from "./validate-and-fix.js";
import {getValidateAndJson} from "./validate-and-json.js";
import validateAndReport from "./validate-and-report.js";

import type {JsonItem, FileProcessor, Options} from "./types";

const getValidator = (
    options: Options,
    jsonItems: Array<JsonItem>,
): FileProcessor => {
    const {json, autoFix} = options;

    if (json) {
        return getValidateAndJson(jsonItems);
    }
    if (autoFix) {
        return validateAndFix;
    }
    return validateAndReport;
};

export default getValidator;
