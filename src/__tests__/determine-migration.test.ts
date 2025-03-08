import {determineMigration} from "../determine-migration";
import {Options, Target} from "../types";

describe("determineMigration", () => {
    it.each`
        migrations
        ${undefined}
        ${{mappings: new Map()}}
        ${{mappings: new Map([["anothertest/1", "http://example.com/1/"], ["test/1/", "https://example.com/2/"]])}}
    `(
        "should return undefined if there are no matching migrations in $migrations",
        ({migrations}) => {
            // Arrange
            const options: Options = {migration: migrations} as any;
            const sourceRef: Target = {target: "some/other/1/thing.ts"} as any;

            // Act
            const result = determineMigration(options, sourceRef);

            // Assert
            expect(result).toBeUndefined();
        },
    );

    it("should return the migrated target if there is a matching migration", () => {
        // Arrange
        const options: Options = {
            migration: {
                mappings: {
                    "anothertest/1": "http://example.com/1/",
                    "test/1/": "https://example.com/2/",
                },
            },
        } as any;
        const sourceRef: Target = {target: "test/1/file.ts"} as any;

        // Act
        const result = determineMigration(options, sourceRef);

        // Assert
        expect(result).toEqual("https://example.com/2/file.ts");
    });

    it("should return the migrated target for the longest match", () => {
        // Arrange
        const options: Options = {
            migration: {
                mode: "missing",
                mappings: {
                    "a/": "http://example.com/shortest/",
                    "a/b/c/": "https://example.com/longest/",
                    "a/b/": "https://example.com/middle/",
                },
            },
        } as any;
        const sourceRef: Target = {target: "a/b/c/file.ts"} as any;

        // Act
        const result = determineMigration(options, sourceRef);

        // Assert
        expect(result).toEqual("https://example.com/longest/file.ts");
    });
});
