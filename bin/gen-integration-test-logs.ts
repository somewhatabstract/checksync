#!/usr/bin/env -S node -r @swc-node/register
/* eslint-disable no-console */

/**
 * This will run checksync for each of our examples, and output the verbose
 * logs to disk so that the snapshot tests can be run against them.
 *
 * NOTE: This all used to happen in Jest but fast-glob promises aren't
 * resolving there properly. Rather than fight that, this is the workaround
 * that allows us to still leverage the Jest snapshot-style diffing and
 * feedback.
 */

import fs from "fs";
import chalk from "chalk";

import {
    EXAMPLES_DIR,
    TESTOUTPUT_DIR,
    getExamples,
    runChecksync,
    writeLog,
    Scenario,
} from "../src/integration-test-support";

/**
 * Process each example and write out the logs.
 */
const main = async () => {
    // Turn off our terminal color stuff so the logs are easier to read.
    chalk.level = 0;

    // Set the working directory to the examples folder
    process.chdir(EXAMPLES_DIR);

    // Clear the test output directory.
    try {
        fs.rmSync(TESTOUTPUT_DIR, {recursive: true});
    } catch (error) {
        // If the directory doesn't exist, that's fine.
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    // Ensure the test output directory exists
    if (!fs.existsSync(TESTOUTPUT_DIR)) {
        fs.mkdirSync(TESTOUTPUT_DIR);
    }

    // For each example, run checksync and write out the results.
    const examples = getExamples();
    for (const example of examples) {
        for (const scenario of Object.values(Scenario)) {
            try {
                console.group(
                    `Running example: ${example}, scenario: ${scenario}`,
                );
                const log = await runChecksync(example, scenario);
                await writeLog(example, scenario, log);
            } catch (error) {
                console.error(error);
            } finally {
                console.groupEnd();
            }
        }
    }
    console.log("All examples have been recorded.");
};

main().catch((error) => {
    console.error("An error occurred:", error);
    process.exit(1);
});
