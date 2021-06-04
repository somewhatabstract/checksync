// @flow
import getOutput from "../get-output.js";
import outputJson from "../output-json.js";
import outputText from "../output-text.js";

import type {Options} from "../types.js";

describe("#getOutput", () => {
    it("should return outputJson if options.json is true", () => {
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

        // Act
        const result = getOutput(options);

        // Assert
        expect(result).toBe(outputJson);
    });

    it("should return outputText if options.json is false", () => {
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
        const result = getOutput(options);

        // Assert
        expect(result).toBe(outputText);
    });
});
