import escapeRegExp from "lodash/escapeRegExp";

import {NormalizeOptions} from "./types";

/**
 * Replace machine- and release-specific values in checksync output.
 *
 * This makes output comparable across machines, operating systems, releases,
 * and implementations. On platforms that separate paths with a backslash,
 * backslashes (including JSON-escaped ones) become forward slashes. Then the
 * repository root becomes `<ROOT>`, the launch string becomes `checksync`, and
 * the version reported in JSON output becomes `0.0.0`.
 *
 * @param output The output to normalize.
 * @param options The values to replace.
 * @returns The normalized output.
 */
export default function normalizeOutput(
    output: string,
    {rootDir, launchString, pathSeparator}: NormalizeOptions,
): string {
    const toForwardSlashes = (text: string): string =>
        pathSeparator === "\\" ? text.replace(/\\\\|\\/g, "/") : text;
    return toForwardSlashes(output)
        .replace(
            new RegExp(escapeRegExp(toForwardSlashes(rootDir)), "g"),
            "<ROOT>",
        )
        .replace(
            new RegExp(escapeRegExp(toForwardSlashes(launchString)), "g"),
            "checksync",
        )
        .replace(/"version": "\d+\.\d+\.\d+[^"]*"/g, `"version": "0.0.0"`);
}
