import {ConformanceCase, RunResult} from "./types";

/**
 * Format one output stream as a transcript section.
 *
 * Mirrors the unified diff convention for a stream that lacks a final
 * newline, so the transcript stays byte-exact without hiding that fact.
 */
const formatStream = (name: string, content: string): string => {
    const body =
        content === "" || content.endsWith("\n")
            ? content
            : `${content}\n\\ No newline at end of ${name}\n`;
    return `--- ${name} ---\n${body}`;
};

/**
 * Keep the first line of some output, noting whether anything followed it.
 */
const keepFirstLine = (content: string): string => {
    const newline = content.indexOf("\n");
    if (newline < 0 || newline === content.length - 1) {
        return content;
    }
    return `${content.slice(0, newline + 1)}(rest not recorded)\n`;
};

/**
 * Format a conformance case and its result as a golden transcript.
 *
 * The working directory is included when the case sets one, so that the
 * transcript says how to reproduce the run.
 *
 * @param testCase The case that was run.
 * @param result The normalized result of running it.
 * @returns The transcript text.
 */
export default function formatTranscript(
    testCase: ConformanceCase,
    result: RunResult,
): string {
    const stderr = testCase.stderrFirstLineOnly
        ? keepFirstLine(result.stderr)
        : result.stderr;
    return [
        `args: ${JSON.stringify(testCase.args)}\n`,
        testCase.cwd == null ? "" : `cwd: ${testCase.cwd}\n`,
        `exit code: ${result.exitCode}\n`,
        formatStream("stdout", result.stdout),
        formatStream("stderr", stderr),
    ].join("");
}
