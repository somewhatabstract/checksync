import normalizeOutput from "./normalize-output";
import {NormalizeOptions} from "./types";

/**
 * Normalize a parsed JSON value so that it can be compared structurally.
 *
 * Object keys are sorted so that key order doesn't matter, array order is
 * kept, and every string, including keys, is normalized like checksync
 * output.
 *
 * @param value The parsed JSON value.
 * @param options The values to replace in strings.
 * @returns The normalized value.
 */
export default function normalizeJsonValue(
    value: unknown,
    options: NormalizeOptions,
): unknown {
    if (typeof value === "string") {
        return normalizeOutput(value, options);
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeJsonValue(item, options));
    }
    if (value != null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, item]): [string, unknown] => [
                    normalizeOutput(key, options),
                    normalizeJsonValue(item, options),
                ])
                .sort(([a], [b]) => (a < b ? -1 : 1)),
        );
    }
    return value;
}
