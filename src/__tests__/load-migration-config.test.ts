import Logger from "../logger";
import {loadMigrationConfig} from "../load-migration-config";

describe("loadMigrationConfig", () => {
    it("should return undefined if migrationConfig is undefined", () => {
        // Arrange
        const NullLogger = new Logger(null, true);

        // Act
        const result = loadMigrationConfig(undefined, NullLogger);

        // Assert
        expect(result).toBeUndefined();
    });

    it("should return undefined if there are no mappings", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const migrationConfig = {
            mode: "all" as const,
            mappings: [],
        };

        // Act
        const result = loadMigrationConfig(migrationConfig, NullLogger);

        // Assert
        expect(result).toBeUndefined();
    });

    it("should throw if there are duplicate mappings", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const migrationConfig = {
            mode: "all" as const,
            mappings: [
                {from: ["a"], to: "b"},
                {from: ["a"], to: "c"},
            ],
        };

        // Act
        const act = () => loadMigrationConfig(migrationConfig, NullLogger);

        // Assert
        expect(act).toThrowErrorMatchingInlineSnapshot(
            `"Duplicate prefixes in migration configuration"`,
        );
    });

    it("should log duplicate mappings", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const migrationConfig = {
            mode: "all" as const,
            mappings: [
                {from: ["a"], to: "b"},
                {from: ["a"], to: "c"},
            ],
        };
        const errorSpy = jest.spyOn(NullLogger, "error");

        // Act
        try {
            loadMigrationConfig(migrationConfig, NullLogger);
        } catch (error) {
            // Ignore the error
        }

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "Prefix a is mapped to multiple targets: b, c",
        );
    });

    it("should return the loaded migration options", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const migrationConfig = {
            mode: "all" as const,
            mappings: [
                {from: ["a"], to: "b"},
                {from: ["c"], to: "d"},
            ],
        };

        // Act
        const result = loadMigrationConfig(migrationConfig, NullLogger);

        // Assert
        expect(result).toEqual({
            mode: "all",
            mappings: new Map([
                ["a", "b"],
                ["c", "d"],
            ]),
        });
    });
});
