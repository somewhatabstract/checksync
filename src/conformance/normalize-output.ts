import escapeRegExp from "lodash/escapeRegExp";

import {NormalizeOptions} from "./types";

/**
 * Replace machine- and release-specific values in checksync output.
 *
 * This makes output comparable across machines, operating systems, releases,
 * and implementations. The repository root becomes `<ROOT>` (with either
 * separator style), the launch string becomes `checksync`, and the version
 * reported in JSON output becomes `0.0.0`.
 *
 * @param output The output to normalize.
 * @param options The values to replace.
 * @returns The normalized output.
 */
export default function normalizeOutput(
    output: string,
    {rootDir, launchString}: NormalizeOptions,
): string {
    const rootDirs = new Set([rootDir, rootDir.replaceAll("\\", "/")]);
    let normalized = output;
    for (const dir of rootDirs) {
        normalized = normalized.replace(
            new RegExp(escapeRegExp(dir), "g"),
            "<ROOT>",
        );
    }
    return normalized
        .replace(new RegExp(escapeRegExp(launchString), "g"), "checksync")
        .replace(/"version": "\d+\.\d+\.\d+[^"]*"/g, `"version": "0.0.0"`);
}
