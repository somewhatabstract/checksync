import * as NormalizeOutput from "../normalize-output";
import normalizeJsonValue from "../normalize-json-value";

jest.mock("../normalize-output");

describe("#normalizeJsonValue", () => {
    const options = {
        rootDir: "/repo",
        launchString: "checksync",
        pathSeparator: "/",
    };

    it("should sort object keys so key order doesn't affect the comparison", () => {
        // Arrange
        jest.spyOn(NormalizeOutput, "default").mockImplementation((s) => s);
        const value = {c: 1, a: 2, b: 3};

        // Act
        const result = normalizeJsonValue(value, options);
        const keys = Object.keys(result as object);

        // Assert
        expect(keys).toEqual(["a", "b", "c"]);
    });

    it("should sort the keys of nested objects", () => {
        // Arrange
        jest.spyOn(NormalizeOutput, "default").mockImplementation((s) => s);
        const value = {outer: {y: 1, x: 2}};

        // Act
        const result = normalizeJsonValue(value, options) as {outer: object};
        const keys = Object.keys(result.outer);

        // Assert
        expect(keys).toEqual(["x", "y"]);
    });

    it("should keep array order since it can be meaningful", () => {
        // Arrange
        jest.spyOn(NormalizeOutput, "default").mockImplementation((s) => s);
        const value = ["b", "a"];

        // Act
        const result = normalizeJsonValue(value, options);

        // Assert
        expect(result).toEqual(["b", "a"]);
    });

    it("should normalize string values so machine-specific paths are replaced", () => {
        // Arrange
        jest.spyOn(NormalizeOutput, "default").mockImplementation((s) =>
            s.replace("/repo", "<ROOT>"),
        );
        const value = {target: "/repo/a.js"};

        // Act
        const result = normalizeJsonValue(value, options);

        // Assert
        expect(result).toEqual({target: "<ROOT>/a.js"});
    });

    it("should normalize object keys since the cache is keyed by file path", () => {
        // Arrange
        jest.spyOn(NormalizeOutput, "default").mockImplementation((s) =>
            s.replace("/repo", "<ROOT>"),
        );
        const value = {"/repo/a.js": 1};

        // Act
        const result = normalizeJsonValue(value, options);

        // Assert
        expect(result).toEqual({"<ROOT>/a.js": 1});
    });

    it.each([42, true, null])("should leave %s unchanged", (value) => {
        // Arrange

        // Act
        const result = normalizeJsonValue(value, options);

        // Assert
        expect(result).toBe(value);
    });
});
