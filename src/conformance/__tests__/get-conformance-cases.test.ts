import getConformanceCases from "../get-conformance-cases";

describe("#getConformanceCases", () => {
    it("should create a check-only, json, and autofix dry-run case per example", () => {
        // Arrange
        const examples = ["an_example"];

        // Act
        const result = getConformanceCases(examples);

        // Assert
        expect(result).toEqual([
            {
                id: "an_example/check-only",
                args: ["__examples__/an_example/**"],
            },
            {
                id: "an_example/json",
                args: ["--json", "__examples__/an_example/**"],
            },
            {
                id: "an_example/autofix-dry-run",
                args: [
                    "--update-tags",
                    "--dry-run",
                    "__examples__/an_example/**",
                ],
            },
        ]);
    });

    it("should keep the given example order so goldens are recorded deterministically", () => {
        // Arrange
        const examples = ["b", "a"];

        // Act
        const result = getConformanceCases(examples);
        const ids = result.map((c) => c.id);

        // Assert
        expect(ids).toEqual([
            "b/check-only",
            "b/json",
            "b/autofix-dry-run",
            "a/check-only",
            "a/json",
            "a/autofix-dry-run",
        ]);
    });

    it("should migrate all tags for the migrate_all example since that is what it covers", () => {
        // Arrange
        const examples = ["migrate_all"];

        // Act
        const [checkOnly] = getConformanceCases(examples);

        // Assert
        expect(checkOnly.args).toEqual([
            "--migrate",
            "all",
            "__examples__/migrate_all/**",
        ]);
    });
});
