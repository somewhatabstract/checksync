import formatSchemaErrors from "../format-schema-errors";
import {SchemaValidationResult} from "../types";

const SCHEMA = "https://json-schema.org/draft/2020-12/schema";

const leaf = (
    rule: string,
    instanceLocation: string,
): SchemaValidationResult => ({
    keyword: `${SCHEMA}#${rule}`,
    instanceLocation,
    valid: false,
    errors: [],
});

describe("#formatSchemaErrors", () => {
    it("should return nothing for a valid result", () => {
        // Arrange
        const result = {
            keyword: `${SCHEMA}#validate`,
            instanceLocation: "#",
            valid: true,
        };

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toBeEmpty();
    });

    it("should name the value and the rule it broke", () => {
        // Arrange
        const result = leaf("type", "#/comments");

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([
            `"comments" does not satisfy the schema's "type" rule`,
        ]);
    });

    it("should refer to the whole configuration when the failure is at its top", () => {
        // Arrange
        const result = leaf("additionalProperties", "#");

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([
            `The configuration does not satisfy the schema's "additionalProperties" rule`,
        ]);
    });

    it("should describe only the deepest failures since they say what broke", () => {
        // Arrange
        const result = {
            keyword: `${SCHEMA}#validate`,
            instanceLocation: "#",
            valid: false,
            errors: [
                {
                    keyword: `${SCHEMA}#properties`,
                    instanceLocation: "#",
                    valid: false,
                    errors: [leaf("type", "#/comments")],
                },
            ],
        };

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([
            `"comments" does not satisfy the schema's "type" rule`,
        ]);
    });

    it("should describe every failure, in the order reported", () => {
        // Arrange
        const result = {
            keyword: `${SCHEMA}#properties`,
            instanceLocation: "#",
            valid: false,
            errors: [
                leaf("type", "#/comments"),
                leaf("enum", "#/migration/mode"),
            ],
        };

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([
            `"comments" does not satisfy the schema's "type" rule`,
            `"migration/mode" does not satisfy the schema's "enum" rule`,
        ]);
    });

    it("should skip checks that passed alongside ones that failed", () => {
        // Arrange
        const result = {
            keyword: `${SCHEMA}#properties`,
            instanceLocation: "#",
            valid: false,
            errors: [
                {...leaf("type", "#/json"), valid: true},
                leaf("type", "#/comments"),
            ],
        };

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([
            `"comments" does not satisfy the schema's "type" rule`,
        ]);
    });

    it("should describe a value the schema forbids outright as an unknown option", () => {
        // Arrange
        const result = leaf("validate", "#/notAnOption");

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([`"notAnOption" is not a known option`]);
    });

    it("should describe a failure that reports no nested checks", () => {
        // Arrange
        const result = {
            keyword: `${SCHEMA}#type`,
            instanceLocation: "#/comments",
            valid: false,
        };

        // Act
        const messages = formatSchemaErrors(result);

        // Assert
        expect(messages).toEqual([
            `"comments" does not satisfy the schema's "type" rule`,
        ]);
    });
});
