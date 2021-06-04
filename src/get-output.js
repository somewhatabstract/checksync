// @flow

import outputJson from "./output-json.js";
import outputText from "./output-text.js";

import type {ErrorCode} from "./error-codes.js";
import type {Options, ILog, JsonItem} from "./types.js";

type OutputFn = (
    options: Options,
    log: ILog,
    jsonItems: Array<JsonItem>,
    violationFileNames: Array<string>,
) => ErrorCode;

const getOutput = (options: Options): OutputFn => {
    const {json} = options;

    return json ? outputJson : outputText;
};

export default getOutput;
