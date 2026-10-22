import * as NormalizeJsonValue from "../normalize-json-value";
import normalizeCache from "../normalize-cache";

jest.mock("../normalize-json-value");

describe("#normalizeCache", () => {
    const options = {
        rootDir: "/repo",
        launchString: "checksync",
        pathSeparator: "/",
    };

    it("should normalize the parsed cache", () => {
        // Arrange
        const normalizeJsonValueSpy = jest
            .spyOn(NormalizeJsonValue, "default")
            .mockReturnValue({});

        // Act
        normalizeCache(`{"a": 1}`, options);

        // Assert
        expect(normalizeJsonValueSpy).toHaveBeenCalledWith({a: 1}, options);
    });

    it("should format the normalized cache with 4-space indents and a final newline for readable diffs", () => {
        // Arrange
        jest.spyOn(NormalizeJsonValue, "default").mockReturnValue({a: [1]});

        // Act
        const result = normalizeCache("{}", options);

        // Assert
        expect(result).toBe(`{\n    "a": [\n        1\n    ]\n}\n`);
    });

    it("should throw if the cache isn't valid JSON", () => {
        // Arrange

        // Act
        const act = () => normalizeCache("not json", options);

        // Assert
        expect(act).toThrow(SyntaxError);
    });
});
