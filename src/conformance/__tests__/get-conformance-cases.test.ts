import getConformanceCases from "../get-conformance-cases";

describe("#getConformanceCases", () => {
    it("should create a check-only, json, autofix dry-run, output-cache, and autofix case per example", () => {
        // Arrange
        const examples = ["an_example"];

        // Act
        const result = getConformanceCases(examples);

        // Assert
        expect(result).toEqual([
            {
                id: "an_example.check-only",
                args: ["__examples__/an_example/**"],
            },
            {
                id: "an_example.json",
                args: ["--json", "__examples__/an_example/**"],
            },
            {
                id: "an_example.autofix-dry-run",
                args: [
                    "--update-tags",
                    "--dry-run",
                    "__examples__/an_example/**",
                ],
            },
            {
                id: "an_example.output-cache",
                args: [
                    "--output-cache",
                    ".conformance-output/an_example.cache.json",
                    "__examples__/an_example/**",
                ],
                cacheFile: ".conformance-output/an_example.cache.json",
            },
            {
                id: "an_example.autofix",
                args: ["--update-tags", "__examples__/an_example/**"],
                scratchExample: "an_example",
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
            "b.check-only",
            "b.json",
            "b.autofix-dry-run",
            "b.output-cache",
            "b.autofix",
            "a.check-only",
            "a.json",
            "a.autofix-dry-run",
            "a.output-cache",
            "a.autofix",
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

    it("should migrate all tags when recording the migrate_all cache so it matches the other scenarios", () => {
        // Arrange
        const examples = ["migrate_all"];

        // Act
        const outputCache = getConformanceCases(examples).find(
            (c) => c.id === "migrate_all.output-cache",
        );

        // Assert
        expect(outputCache?.args).toEqual([
            "--output-cache",
            ".conformance-output/migrate_all.cache.json",
            "--migrate",
            "all",
            "__examples__/migrate_all/**",
        ]);
    });

    it("should migrate all tags when autofixing the migrate_all example so its writes match the other scenarios", () => {
        // Arrange
        const examples = ["migrate_all"];

        // Act
        const autofix = getConformanceCases(examples).find(
            (c) => c.id === "migrate_all.autofix",
        );

        // Assert
        expect(autofix?.args).toEqual([
            "--update-tags",
            "--migrate",
            "all",
            "__examples__/migrate_all/**",
        ]);
    });
});
