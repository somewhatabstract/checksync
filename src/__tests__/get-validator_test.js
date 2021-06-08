// @flow
import getValidator from "../get-validator.js";
import * as ValidateAndJson from "../validate-and-json.js";
import validateAndFix from "../validate-and-fix.js";
import validateAndReport from "../validate-and-report.js";

import type {Options} from "../types.js";

describe("#getValidator", () => {
    it("should return the result of getValidateAndJson(jsonItems) when options.json is true", () => {
        // Arrange
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: true,
        };
        const validateAndJsonMock = jest.fn();
        jest.spyOn(ValidateAndJson, "getValidateAndJson").mockReturnValue(
            validateAndJsonMock,
        );

        // Act
        const result = getValidator(options, []);

        // Assert
        expect(result).toEqual(validateAndJsonMock);
    });

    it("should return validateAndFix when options.autoFix is true", () => {
        // Arrange
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        const result = getValidator(options, []);

        // Assert
        expect(result).toEqual(validateAndFix);
    });

    it("should return validateAndReport in all other cases", () => {
        // Arrange
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        const result = getValidator(options, []);

        // Assert
        expect(result).toEqual(validateAndReport);
    });
});
