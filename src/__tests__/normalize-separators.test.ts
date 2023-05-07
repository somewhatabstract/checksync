import normalizeSeparators from "../normalize-separators";

jest.mock("path", () => ({
    sep: "{FAKE_SEP}",
}));

describe("#normalizeSeparators", () => {
    it("should replace path.sep with forward slash in a given string", () => {
        // Arrange

        // Act
        const result = normalizeSeparators(
            "{FAKE_SEP}path{FAKE_SEP}to{FAKE_SEP}file.js",
        );

        // Assert
        expect(result).toBe("/path/to/file.js");
    });
});
