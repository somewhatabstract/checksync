// @flow
import ignoreFormatToGlobs from "../ignore-format-to-globs.js";

describe("#ignoreFormatToGlobs", () => {
    it("should expand foo format includes", () => {
        // Arrange

        // Act
        const result = Array.from(ignoreFormatToGlobs(["foo"]));

        // Assert
        expect(result).toIncludeAllMembers(["**/foo/**", "foo"]);
    });

    it("should expand /foo format includes", () => {
        // Arrange

        // Act
        const result = Array.from(ignoreFormatToGlobs(["/foo"]));

        // Assert
        expect(result).toIncludeAllMembers(["/foo/**", "/foo"]);
    });

    it("should expand /foo/ format includes", () => {
        // Arrange

        // Act
        const result = Array.from(ignoreFormatToGlobs(["/foo/"]));

        // Assert
        expect(result).toIncludeAllMembers(["/foo/**"]);
    });

    it("should expand foo/ format includes", () => {
        // Arrange

        // Act
        const result = Array.from(ignoreFormatToGlobs(["foo/"]));

        // Assert
        expect(result).toIncludeAllMembers(["**/foo/**"]);
    });
});
