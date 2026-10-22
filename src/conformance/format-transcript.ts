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
 * Format a conformance case and its result as a golden transcript.
 *
 * @param testCase The case that was run.
 * @param result The normalized result of running it.
 * @returns The transcript text.
 */
export default function formatTranscript(
    testCase: ConformanceCase,
    result: RunResult,
): string {
    return [
        `args: ${JSON.stringify(testCase.args)}\n`,
        `exit code: ${result.exitCode}\n`,
        formatStream("stdout", result.stdout),
        formatStream("stderr", result.stderr),
    ].join("");
}
