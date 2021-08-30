// @flow
import fs from "fs";
import {promisify} from "util";
import JsonSchema, {DETAILED} from "@hyperjump/json-schema";

import type {ILog, Options} from "./types.js";
import FileReferenceLogger from "./file-reference-logger.js";

const readFileAsync = promisify(fs.readFile);

export default async function loadConfigurationFile(
    path: string,
    log: ILog,
): Promise<?Options> {
    const rcLog = new FileReferenceLogger(path, log);
    try {
        const rcFile: string = await readFileAsync(path);
        const rcJson = JSON.parse(rcFile);
        const schema = await JsonSchema.get("./checksync.schema.json");
        const validation = await JsonSchema.validate(schema, rcJson, DETAILED);
        if (validation.valid) {
            return rcJson;
        }

        // TODO:  outputValidationErrors(validation.errors);
    } catch (error) {
        rcLog.error(error.message);
    }

    // If we get here, we failed to validate the file.
    throw new Error(`Unable to load rc file: ${path}`);
}
