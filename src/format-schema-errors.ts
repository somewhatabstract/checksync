import {SchemaValidationResult} from "./types";

/**
 * Describe each way a configuration fails its schema.
 *
 * Only the deepest failures are described, since they name the value and
 * the rule it broke; the ones above them only say that something inside
 * failed. A value the schema forbids outright is described as an unknown
 * option, since that is the only way the checksync schema forbids one.
 *
 * @param result The validator's detailed output for the configuration.
 * @returns One message per failed rule, in the order they were reported.
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
    const location = result.instanceLocation.replace(/^#\/?/, "");
    const value = location === "" ? "The configuration" : `"${location}"`;
    // A failed "validate" with nothing beneath it is a value the schema
    // forbids outright, such as an option it doesn't know.
    return rule === "validate"
        ? [`${value} is not a known option`]
        : [`${value} does not satisfy the schema's "${rule}" rule`];
}
