// @flow

import outputJson from "./output-json.js";
import outputText from "./output-text.js";

import type {Options, OutputFn} from "./types.js";

const getOutput = (options: Options): OutputFn => {
    const {json} = options;

    return json ? outputJson : outputText;
};

export default getOutput;
