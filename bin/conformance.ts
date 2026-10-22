#!/usr/bin/env -S node -r @swc-node/register
/* eslint-disable no-console */

/**
 * Run checksync over every example and compare against golden files.
 *
 * Usage:
 *   conformance [--update] [--launcher <executable>]
 *
 * --update     Record the current output as the new golden files.
 * --launcher   Run this executable instead of the Node implementation, e.g.
 *              to check another implementation against the same goldens.
 */

import fs from "fs";
import path from "path";
import {spawnSync} from "child_process";

import {getExamples} from "../src/integration-test-support";
import getConformanceCases from "../src/conformance/get-conformance-cases";
import runChecksync from "../src/conformance/run-checksync";
import normalizeOutput from "../src/conformance/normalize-output";
import normalizeCache from "../src/conformance/normalize-cache";
import formatTranscript from "../src/conformance/format-transcript";
import checkGolden from "../src/conformance/check-golden";
import getActualPath from "../src/conformance/get-actual-path";
import {Launcher} from "../src/conformance/types";

const ROOT_DIR = path.join(__dirname, "..");
const GOLDEN_DIR = path.join(ROOT_DIR, "__conformance__", "examples");

/**
 * Check or record one golden file, reporting a failure.
 *
 * @returns Whether the check failed.
 */
const checkAndReport = (
    goldenPath: string,
    content: string,
    update: boolean,
): boolean => {
    const outcome = checkGolden(goldenPath, content, update);
    if (outcome === "match" || outcome === "updated") {
        return false;
    }
    console.error(`${outcome}: ${path.relative(ROOT_DIR, goldenPath)}`);
    if (outcome === "mismatch") {
        // Show the difference, since CI logs are all we see there.
        spawnSync(
            "git",
            ["diff", "--no-index", "--", goldenPath, getActualPath(goldenPath)],
            {stdio: "inherit"},
        );
    }
    return true;
};

const main = (argv: ReadonlyArray<string>): number => {
    const update = argv.includes("--update");
    const launcherIndex = argv.indexOf("--launcher");
    const nodeScript = path.join(ROOT_DIR, "bin", "checksync.js");
    const launcher: Launcher =
        launcherIndex >= 0
            ? {command: path.resolve(argv[launcherIndex + 1]), args: []}
            : {command: process.execPath, args: [nodeScript]};
    const normalizeOptions = {
        rootDir: ROOT_DIR,
        launchString:
            launcherIndex >= 0
                ? path.relative(ROOT_DIR, launcher.command)
                : path.relative(ROOT_DIR, nodeScript),
        pathSeparator: path.sep,
    };

    let failures = 0;
    for (const testCase of getConformanceCases(getExamples())) {
        const cachePath =
            testCase.cacheFile == null
                ? null
                : path.join(ROOT_DIR, testCase.cacheFile);
        if (cachePath != null) {
            // checksync doesn't create the directory, and a stale cache
            // must not be mistaken for this run's output.
            fs.mkdirSync(path.dirname(cachePath), {recursive: true});
            fs.rmSync(cachePath, {force: true});
        }

        const result = runChecksync(launcher, testCase.args, ROOT_DIR);
        const transcript = formatTranscript(testCase, {
            exitCode: result.exitCode,
            stdout: normalizeOutput(result.stdout, normalizeOptions),
            stderr: normalizeOutput(result.stderr, normalizeOptions),
        });
        const goldenBase = path.join(GOLDEN_DIR, testCase.id);
        if (checkAndReport(`${goldenBase}.txt`, transcript, update)) {
            failures++;
        }

        if (cachePath != null) {
            const cache = fs.existsSync(cachePath)
                ? normalizeCache(
                      fs.readFileSync(cachePath, "utf8"),
                      normalizeOptions,
                  )
                : "No cache file was written.\n";
            if (checkAndReport(`${goldenBase}.json`, cache, update)) {
                failures++;
            }
        }
    }

    if (failures > 0) {
        console.error(
            `\n${failures} golden file(s) failed. Mismatched output was ` +
                "written next to each one with `.actual` before its " +
                "extension. Run with --update to accept the new output.",
        );
        return 1;
    }
    console.log(update ? "Golden files updated." : "All cases match.");
    return 0;
};

process.exitCode = main(process.argv.slice(2));
