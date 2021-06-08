// @flow
import path from "path";
import escapeRegExp from "lodash/escapeRegExp";

import getLaunchString from "./get-launch-string.js";
import ErrorCodes from "./error-codes.js";
import {version} from "../package.json";

import type {ErrorCode} from "./error-codes.js";
import type {ILog, JsonItem, Options} from "./types";

const outputJson = (
    options: Options,
    log: ILog,
    jsonItems: Array<JsonItem>,
    violationFileNames: Array<string>,
): ErrorCode => {
    const regex = new RegExp(escapeRegExp(path.sep), "g");
    const normalize = (snippet: string): string => snippet.replace(regex, "/");

    const normalizedJsonItems = jsonItems.map((item: JsonItem): JsonItem => {
        if (item.type === "error") {
            return {
                ...item,
                sourceFile: normalize(item.sourceFile),
                targetFile: normalize(item.targetFile),
                message: normalize(item.message),
            };
        } else {
            return {
                ...item,
                sourceFile: normalize(item.sourceFile),
                targetFile: normalize(item.targetFile),
                message: normalize(item.message),
                fix: item.fix && normalize(item.fix),
            };
        }
    });

    log.log(
        JSON.stringify(
            {
                version: version,
                launchString: getLaunchString(),
                items: normalizedJsonItems,
            },
            null,
            4,
        ),
    );
    return ErrorCodes.SUCCESS;
};

export default outputJson;
