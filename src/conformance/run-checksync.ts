import {spawnSync} from "child_process";

import {Launcher, RunResult} from "./types";

/**
 * Run checksync as a subprocess and capture its output.
 *
 * Color is disabled so that the output is plain text, and Node deprecation
 * warnings are suppressed since they are not checksync's output.
 *
 * @param launcher The command used to launch checksync.
 * @param args The arguments to pass to checksync.
 * @param cwd The working directory to run checksync in.
 * @returns The exit code, stdout, and stderr of the run.
 * @throws {Error} If the process could not be started or was killed.
 */
export default function runChecksync(
    launcher: Launcher,
    args: ReadonlyArray<string>,
    cwd: string,
): RunResult {
    const result = spawnSync(launcher.command, [...launcher.args, ...args], {
        cwd,
        encoding: "utf8",
        env: {
            ...process.env,
            FORCE_COLOR: "0",
            NODE_OPTIONS: "--no-deprecation",
        },
    });

    if (result.error != null) {
        throw result.error;
    }
    if (result.status == null) {
        throw new Error(`checksync was terminated by signal ${result.signal}`);
    }

    return {
        exitCode: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    };
}
