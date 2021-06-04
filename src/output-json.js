// @flow
import getLaunchString from "./get-launch-string.js";
import ErrorCodes from "./error-codes.js";
import {version} from "../package.json";

import type {ErrorCode} from "./error-codes.js";
import type {ILog, JsonItem} from "./types";

const outputJson = (log: ILog, jsonItems: Array<JsonItem>): ErrorCode => {
    log.log(
        JSON.stringify(
            {
                version: version,
                launchString: getLaunchString(),
                items: jsonItems,
            },
            null,
            4,
        ),
    );
    return ErrorCodes.SUCCESS;
};

export default outputJson;
