#!/usr/bin/env -S node -r @swc-node/register
/* eslint-disable no-console */

/**
 * Run checksync over every example and compare against golden transcripts.
 *
 * Usage:
 *   conformance [--update] [--launcher <executable>]
 *
 * --update     Record the current output as the new golden transcripts.
 * --launcher   Run this executable instead of the Node implementation, e.g.
 *              to check another implementation against the same goldens.
 */

import path from "path";

import {getExamples} from "../src/integration-test-support";
import getConformanceCases from "../src/conformance/get-conformance-cases";
import runChecksync from "../src/conformance/run-checksync";
import normalizeOutput from "../src/conformance/normalize-output";
import formatTranscript from "../src/conformance/format-transcript";
import checkGolden from "../src/conformance/check-golden";
import {Launcher} from "../src/conformance/types";

const ROOT_DIR = path.join(__dirname, "..");
const GOLDEN_DIR = path.join(ROOT_DIR, "__conformance__", "examples");

const main = (argv: ReadonlyArray<string>): number => {
    const update = argv.includes("--update");
    const launcherIndex = argv.indexOf("--launcher");
    const nodeScript = path.join(ROOT_DIR, "bin", "checksync.js");
    const launcher: Launcher =
        launcherIndex >= 0
            ? {command: path.resolve(argv[launcherIndex + 1]), args: []}
            : {command: process.execPath, args: [nodeScript]};
    const launchString =
        launcherIndex >= 0
            ? path.relative(ROOT_DIR, launcher.command)
            : path.relative(ROOT_DIR, nodeScript);

    let failures = 0;
    for (const testCase of getConformanceCases(getExamples())) {
        const result = runChecksync(launcher, testCase.args, ROOT_DIR);
        const normalizeOptions = {rootDir: ROOT_DIR, launchString};
        const transcript = formatTranscript(testCase, {
            exitCode: result.exitCode,
            stdout: normalizeOutput(result.stdout, normalizeOptions),
            stderr: normalizeOutput(result.stderr, normalizeOptions),
        });
        const goldenPath = path.join(GOLDEN_DIR, `${testCase.id}.txt`);
        const outcome = checkGolden(goldenPath, transcript, update);
        if (outcome === "mismatch" || outcome === "missing") {
            failures++;
            console.error(`${outcome}: ${path.relative(ROOT_DIR, goldenPath)}`);
        }
    }

    if (failures > 0) {
        console.error(
            `\n${failures} case(s) failed. Mismatched output was written next ` +
                "to each golden file as *.actual.txt. Run with --update to " +
                "accept the new output.",
        );
        return 1;
    }
    console.log(update ? "Golden transcripts updated." : "All cases match.");
    return 0;
};

process.exitCode = main(process.argv.slice(2));
