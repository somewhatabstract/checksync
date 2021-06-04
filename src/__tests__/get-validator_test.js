// @flow
import getValidator from "../get-validator.js";
import * as ValidateAndJson from "../validate-and-json.js";
import validateAndFix from "../validate-and-fix.js";
import validateAndReport from "../validate-and-report.js";

import type {Options} from "../types.js";

describe("#getValidator", () => {
    it("should return the result of getValidateAndJson(jsonItems) when options.json is true", () => {
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

        const result = getValidator(options, []);

        expect(result).toEqual(validateAndJsonMock);
    });

    it("should return validateAndFix when options.autoFix is true", () => {
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: true,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        const result = getValidator(options, []);

        expect(result).toEqual(validateAndFix);
    });

    it("should return validateAndReport in all other cases", () => {
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: null,
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        const result = getValidator(options, []);

        expect(result).toEqual(validateAndReport);
    });
});
