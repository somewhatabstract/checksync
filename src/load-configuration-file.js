// @flow
import fs from "fs";
import {promisify} from "util";
import {version} from "../package.json";
import JsonSchema, {DETAILED} from "@hyperjump/json-schema";

import type {ILog, Options} from "./types.js";
import FileReferenceLogger from "./file-reference-logger.js";
import checksyncSchema from "./checksync.schema.json";

const readFileAsync = promisify(fs.readFile);

export default async function loadConfigurationFile(
    configPath: string,
    log: ILog,
): Promise<?Options> {
    log.verbose(() => `Loading configuration from ${configPath}`);
    const rcLog = new FileReferenceLogger(configPath, log);
    try {
        // Load the configuration JSON.
        const rcFile: string = await readFileAsync(configPath);
        const rcJson = JSON.parse(rcFile);

        const rcForValidation = {...rcJson};
        if (!rcForValidation.$schema) {
            rcForValidation.$schema = "file://./checksync.schema.json";
        }
        if (!rcForValidation.$schemaVersion) {
            rcForValidation.$schemaVersion = version;
        }
        JsonSchema.setShouldMetaValidate(false);

        // Load the schema versions into the schema validator, giving it a URI to ID it.
        JsonSchema.add(
            checksyncSchema,
            "file://./checksync.schema.json",
            version,
        );

        // Now get that schema using the same URI, and use it to validate the
        // configuration we loaded.
        const schema = await JsonSchema.get("file://./checksync.schema.json");

        log.verbose(() => `Validating configuration`);
        const validation = await JsonSchema.validate(
            schema,
            rcForValidation,
            DETAILED,
        );
        if (validation.valid) {
            log.verbose(() => `Configuration is valid`);

            return rcJson;
        }
    } catch (error) {
        rcLog.error(error.stack);
    }

    // If we get here, we failed to validate the file.
    throw new Error(`Unable to load rc file: ${configPath}`);
}
