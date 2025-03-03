import fs from "fs";
import {promisify} from "util";
import {version} from "../package.json";
import JsonSchema, {DETAILED} from "@hyperjump/json-schema";

import {ILog, Options} from "./types";
import FileReferenceLogger from "./file-reference-logger";
import checksyncSchema from "./checksync.schema.json";
import {loadMigrationConfig} from "./load-migration-config";

const readFileAsync = promisify(fs.readFile);

/**
 * Load the configuration from the given path.
 *
 * @param configPath The path to the configuration file.
 * @param log The log to use for reporting errors.
 * @returns The options loaded from the configuration.
 * @throws An error if the configuration file cannot be loaded.
 */
export default async function loadConfigurationFile(
    configPath: string,
    log: ILog,
): Promise<Options> {
    log.verbose(() => `Loading configuration from ${configPath}`);
    const rcLog = new FileReferenceLogger(configPath, log);
    try {
        // Load the configuration JSON.
        const rcFile = String(await readFileAsync(configPath));
        const rcJson = JSON.parse(rcFile);

        const rcForValidation = {...rcJson} as const;
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
            // We need to parse the migrations config.
            const {migration, ...rest} = rcJson;
            const migrationOptions = loadMigrationConfig(migration, rcLog);

            log.verbose(() => `Configuration is valid`);
            return {
                ...rest,
                migration: migrationOptions,
            };
        }
    } catch (error: any) {
        rcLog.error(error.stack);
    }

    // If we get here, we failed to validate the file.
    throw new Error(`Unable to load rc file: ${configPath}`);
}
