import path from "path";
import fs from "fs";
import ancesdir from "ancesdir";
import StringLogger from "../src/string-logger";

import checkSync from "../src/check-sync";
import determineOptions from "../src/determine-options";
import getLaunchString from "./get-launch-string";
import normalizeSeparators from "./normalize-separators";

export enum Scenario {
    Autofix = "autofix",
    CheckOnly = "check-only",
    JsonCheckOnly = "json-check-only",
}

export const EXAMPLES_DIR = path.join(ancesdir(), "__examples__");
export const TESTOUTPUT_DIR = path.join(ancesdir(), ".integrationtests");

/**
 * Get the examples from the `__examples__` folder.
 *
 * @returns The list of example directories.
 */
export const getExamples = () =>
    fs
        // Iterate over the __examples__ folders and filter out anything we don't
        // want.
        .readdirSync(EXAMPLES_DIR)
        // The whole symlink test is not going to work right on windows
        // so let's just skip it.
        .filter((p) => !(process.platform === "win32" && p.includes("symlink")))
        // We only want directories.
        .filter((name) =>
            fs.lstatSync(path.join(EXAMPLES_DIR, name)).isDirectory(),
        )
        .sort();

/**
 * Run checksync for an example.
 *
 * @param example The glob or folder that represents the example being run.
 * @param scenario The scenario to run.
 * @returns A promise of the verbose logs from the run.
 */
export const runChecksync = async (
    example: string,
    scenario?: Scenario,
): Promise<string> => {
    const stringLogger = new StringLogger(true);

    // This has to be an actual glob, or it won't work.
    const glob = `**/${example}/**`;

    // Depending on the scenario, let's set up the args object.
    const scenarioArgs =
        scenario == null || scenario === Scenario.CheckOnly
            ? {}
            : scenario === Scenario.JsonCheckOnly
              ? {json: true}
              : scenario === Scenario.Autofix
                ? {updateTags: true, dryRun: true}
                : null;

    if (scenarioArgs == null) {
        return Promise.reject(new Error(`Unknown scenario: ${scenario}`));
    }

    const cachePath = path.join(TESTOUTPUT_DIR, `${getFilename(example)}.json`);
    const outputCache = scenario == null ? cachePath : undefined;
    const fromCache = scenario == null ? undefined : cachePath;

    // This takes an args object, looks for and loads the config file,
    // and then combines them with defaults to get the options to run.
    const options = await determineOptions(
        {
            _: [glob],
            ...scenarioArgs,
            outputCache,
            fromCache,
        },
        stringLogger,
    );
    await checkSync(options, stringLogger);
    return stringLogger.getLog();
};

/**
 * Get the base filename for a given example scenario.
 *
 * @param example The example for the log.
 * @param scenario The scenario for the log.
 * @returns The path to the log file.
 */
const getFilename = (example: string, scenario?: Scenario) => {
    // Normalize the example name so that it's a valid file name.
    // Replace spaces, path separators, and other invalid characters.
    const exampleName = example.replace(/[^a-zA-Z0-9]/g, "_");
    if (scenario) {
        return `${exampleName}.${scenario}`;
    }
    return exampleName;
};

/**
 * Get the log path for a given example scenario.
 *
 * @param example The example for the log.
 * @param scenario The scenario for the log.
 * @returns The path to the log file.
 */
const getLogPath = (example: string, scenario?: Scenario) => {
    return path.join(TESTOUTPUT_DIR, `${getFilename(example, scenario)}.log`);
};

/**
 * Write the log to disk for an example.
 *
 * @param example The example being written.
 * @param scenario The scenario being written.
 * @param log The log to write.
 * @returns A promise of the file path written that resolves when the log is
 * written.
 */
export const writeLog = (
    example: string,
    scenario: Scenario | undefined,
    log: string,
): Promise<string> => {
    // Get the file path where the log will be written.
    const logPath = getLogPath(example, scenario);

    // We need to normalize the logs a bit so there's a simpler comparison
    // later.
    // 1. The JSON outputs the version of `"version": "7.0.1"`, we just need
    //    that to be consistent across versions, so change to
    //    `"version": "0.0.0"`.
    // 2. All runs might output the launch string. We can grab that and then
    //    do a find/replace.
    log = log.replaceAll(/"version": "\d+\.\d+\.\d+"/g, `"version": "0.0.0"`);
    log = log.replaceAll(normalizeSeparators(getLaunchString()), "checksync");

    return new Promise((resolve, reject) => {
        fs.writeFile(logPath, log, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(logPath);
            }
        });
    });
};

/**
 * Read the log from disk for an example scenario.
 *
 * @param example The example being read.
 * @param scenario The scenario being read.
 * @returns A promise of the log that resolves when the log is read. The
 * promise will resolve to null if the log does not exist.
 */
export const readLog = (
    example: string,
    scenario: Scenario | undefined,
): Promise<string | null> => {
    // Get the file path where the log will be read.
    const logPath = getLogPath(example, scenario);
    return new Promise((resolve, reject) => {
        fs.readFile(logPath, "utf-8", (err, data) => {
            if (err) {
                if (err.code === "ENOENT") {
                    resolve(null);
                } else {
                    reject(err);
                }
            } else {
                resolve(data);
            }
        });
    });
};
