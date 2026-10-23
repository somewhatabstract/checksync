import normalizeOutput from "../normalize-output";

describe("#normalizeOutput", () => {
    const options = {
        rootDir: "C:\\repo",
        launchString: "bin\\checksync.js",
        pathSeparator: "\\",
    };

    it("should replace the root directory with a placeholder", () => {
        // Arrange
        const output = "Checking C:\\repo\\a.js";

        // Act
        const result = normalizeOutput(output, options);

        // Assert
        expect(result).toBe("Checking <ROOT>/a.js");
    });

    it("should replace the forward-slash form of the root directory with a placeholder", () => {
        // Arrange
        const output = "Checking C:/repo/a.js";

        // Act
        const result = normalizeOutput(output, options);

        // Assert
        expect(result).toBe("Checking <ROOT>/a.js");
    });

    it("should replace the launch string so output doesn't depend on how checksync was run", () => {
        // Arrange
        const output = "bin\\checksync.js -u a.js";

        // Act
        const result = normalizeOutput(output, options);

        // Assert
        expect(result).toBe("checksync -u a.js");
    });

    it("should use forward slashes on Windows so goldens are the same on every platform", () => {
        // Arrange
        const output = "Mismatch __examples__\\a\\b.js:4";

        // Act
        const result = normalizeOutput(output, options);

        // Assert
        expect(result).toBe("Mismatch __examples__/a/b.js:4");
    });

    it("should use forward slashes for JSON-escaped backslashes on Windows", () => {
        // Arrange
        const output = `"__examples__\\\\a\\\\b.js"`;

        // Act
        const result = normalizeOutput(output, options);

        // Assert
        expect(result).toBe(`"__examples__/a/b.js"`);
    });

    it("should leave backslashes alone where they are not path separators", () => {
        // Arrange
        const output = "a\\b";

        // Act
        const result = normalizeOutput(output, {
            ...options,
            pathSeparator: "/",
        });

        // Assert
        expect(result).toBe("a\\b");
    });

    it("should replace the reported version so output doesn't change with each release", () => {
        // Arrange
        const output = `{"version": "10.0.2-beta.1"}`;

        // Act
        const result = normalizeOutput(output, options);

        // Assert
        expect(result).toBe(`{"version": "0.0.0"}`);
    });
});
