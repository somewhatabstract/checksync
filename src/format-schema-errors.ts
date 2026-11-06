import {SchemaValidationResult} from "./types";

/**
 * Decode a JSON pointer fragment into the path it names, such as `a/b c`.
 */
const decodePointer = (fragment: string): string =>
    fragment
        .replace(/^#\/?/, "")
        .split("/")
        .map((segment) =>
            decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~"),
        )
        .join("/");

/**
 * Describe each way a configuration fails its schema.
 *
 * Only the deepest failures are described, since they name the value and
 * the rule it broke; the ones above them only say that something inside
 * failed. A key that the schema's `additionalProperties` forbids is
 * described as an unknown option. The validator may stop at the first
 * failure within an object, so this describes what it reports rather than
 * every problem in the file.
 *
 * @param result The validator's detailed output for the configuration.
 * @returns One message per reported failure, in the order reported.
 */
export default function formatSchemaErrors(
    result: SchemaValidationResult,
): Array<string> {
    if (result.valid) {
        return [];
    }
    const failedChildren = (result.errors ?? []).filter((e) => !e.valid);
    if (failedChildren.length > 0) {
        return failedChildren.flatMap(formatSchemaErrors);
    }
    const rule = result.keyword.slice(result.keyword.lastIndexOf("#") + 1);
    const location = decodePointer(result.instanceLocation);
    const value = location === "" ? "The configuration" : `"${location}"`;
    return result.absoluteKeywordLocation.endsWith("/additionalProperties")
        ? [`${value} is not a known option`]
        : [`${value} does not satisfy the schema's "${rule}" rule`];
}
