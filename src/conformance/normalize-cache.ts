import normalizeJsonValue from "./normalize-json-value";
import {NormalizeOptions} from "./types";

/**
 * Normalize a marker cache file so that it can be compared structurally.
 *
 * The cache records every file checksync scanned along with each tag's
 * checksums and targets. Absolute paths and key order vary by machine and
 * implementation, so the result has machine-specific values replaced and
 * object keys sorted, formatted for readable diffs.
 *
 * @param cacheJson The contents of the cache file.
 * @param options The values to replace.
 * @returns The normalized cache as formatted JSON, ending in a newline.
 * @throws {SyntaxError} If the cache isn't valid JSON.
 */
export default function normalizeCache(
    cacheJson: string,
    options: NormalizeOptions,
): string {
    const normalized = normalizeJsonValue(JSON.parse(cacheJson), options);
    return `${JSON.stringify(normalized, null, 4)}\n`;
}
