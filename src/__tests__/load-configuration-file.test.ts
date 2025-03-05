import JsonSchema from "@hyperjump/json-schema";
import * as FS from "fs";

import Logger from "../logger";
import loadConfigurationFile from "../load-configuration-file";
import * as LoadMigrationConfig from "../load-migration-config";

import PackageJson from "../../package.json";
import FileReferenceLogger from "../file-reference-logger";

jest.mock("fs");

describe("#loadConfigurationFile", () => {
    it("should try to read the file", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const readFileSpy = jest
            .spyOn(FS, "readFile")
            .mockImplementationOnce((path, cb) => {
                cb(null, Buffer.from("LOADED_DATA"));
            });

        // Act
        try {
            await loadConfigurationFile("FILE", NullLogger);
        } catch (e: any) {
            // Don't care for this test case.
        }

        // Assert
        expect(readFileSpy).toHaveBeenCalledWith("FILE", expect.any(Function));
    });

    it("should log error if file read fails", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const errorSpy = jest.spyOn(NullLogger, "error");
        const error = new Error("BOOM!");
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            // @ts-expect-error We are passing null as the read is failing
            cb(error);
        });

        // Act
        try {
            await loadConfigurationFile("FILE", NullLogger);
        } catch (e: any) {
            // Don't care for this test case.
        }

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(error.stack as string),
        );
    });

    it("should throw error if file read fails", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            // @ts-expect-error We are passing null as the read is failing
            cb(new Error("BOOM!"), null);
        });

        // Act
        const underTest = loadConfigurationFile("FILE", NullLogger);

        // Assert
        await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
            `"Unable to load rc file: FILE"`,
        );
    });

    it("should parse the file contents to JSON", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const parseSpy = jest.spyOn(JSON, "parse");
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(null, Buffer.from("LOADED_DATA"));
        });

        // Act
        try {
            await loadConfigurationFile("FILE", NullLogger);
        } catch (e: any) {
            // Don't care for this test case.
        }

        // Assert
        expect(parseSpy).toHaveBeenCalledWith("LOADED_DATA");
    });

    it("should log error if JSON parse fails", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const errorSpy = jest.spyOn(NullLogger, "error");
        const error = new Error("BOOM!");
        jest.spyOn(JSON, "parse").mockImplementation(() => {
            throw error;
        });
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(null, Buffer.from("LOADED_DATA"));
        });

        // Act
        try {
            await loadConfigurationFile("FILE", NullLogger);
        } catch (e: any) {
            // Don't care for this test case.
        }

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(error.stack as string),
        );
    });

    it("should throw error if JSON parse fails", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(JSON, "parse").mockImplementation(() => {
            throw new Error("BOOM!");
        });
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(null, Buffer.from("LOADED_DATA"));
        });

        // Act
        const underTest = loadConfigurationFile("FILE", NullLogger);

        // Assert
        await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
            `"Unable to load rc file: FILE"`,
        );
    });

    it("should validate against JSON schema", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const validateSpy = jest.spyOn(JsonSchema, "validate");
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(
                null,
                Buffer.from(
                    JSON.stringify({
                        $schema: "file://./checksync.schema.json",
                        $schemaVersion: "2.3.0",
                    }),
                ),
            );
        });

        // Act
        await loadConfigurationFile("FILE", NullLogger);

        // Assert
        expect(validateSpy).toHaveBeenCalledWith(
            expect.anything(),
            {
                $schema: "file://./checksync.schema.json",
                $schemaVersion: "2.3.0",
            },
            JsonSchema.DETAILED,
        );
    });

    it("should add schema and schema version to configuration if absent", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        const validateSpy = jest.spyOn(JsonSchema, "validate");
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(null, Buffer.from(JSON.stringify({})));
        });

        // Act
        await loadConfigurationFile("FILE", NullLogger);

        // Assert
        expect(validateSpy).toHaveBeenCalledWith(
            expect.anything(),
            {
                $schema: "file://./checksync.schema.json",
                $schemaVersion: PackageJson.version,
            },
            JsonSchema.DETAILED,
        );
    });

    it("should throw if configuration is not valid", () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(null, Buffer.from(JSON.stringify({notValid: true})));
        });

        // Act
        const underTest = loadConfigurationFile("FILE", NullLogger);

        // Assert
        return expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
            `"Unable to load rc file: FILE"`,
        );
    });

    it("should return the configuration if it is valid", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(
                null,
                Buffer.from(
                    JSON.stringify({
                        autoFix: true,
                        ignoreFiles: [
                            ".gitignore",
                            "**/.gitignore",
                            "./.gitignore",
                            "../.gitignore",
                        ],
                    }),
                ),
            );
        });

        // Act
        const result = await loadConfigurationFile("FILE", NullLogger);

        // Assert
        expect(result).toEqual({
            autoFix: true,
            ignoreFiles: [
                ".gitignore",
                "**/.gitignore",
                "./.gitignore",
                "../.gitignore",
            ],
        });
    });

    it("should load the migration configuration", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(
                null,
                Buffer.from(
                    JSON.stringify({
                        migration: {
                            mode: "all",
                            mappings: [
                                {
                                    from: ["a"],
                                    to: "https://example.com",
                                },
                            ],
                        },
                    }),
                ),
            );
        });
        const loadMigrationConfigSpy = jest
            .spyOn(LoadMigrationConfig, "loadMigrationConfig")
            .mockReturnValueOnce(undefined);

        // Act
        await loadConfigurationFile("FILE", NullLogger);

        // Assert
        expect(loadMigrationConfigSpy).toHaveBeenCalledWith(
            {
                mode: "all",
                mappings: [
                    {
                        from: ["a"],
                        to: "https://example.com",
                    },
                ],
            },
            expect.any(FileReferenceLogger),
        );
    });

    it("should return the loaded migration configuration", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(
                null,
                Buffer.from(
                    JSON.stringify({
                        migration: {
                            mode: "all",
                            mappings: [
                                {
                                    from: ["a"],
                                    to: "https://example.com",
                                },
                            ],
                        },
                    }),
                ),
            );
        });
        jest.spyOn(
            LoadMigrationConfig,
            "loadMigrationConfig",
        ).mockReturnValueOnce({
            mode: "all",
            mappings: new Map([["a", "https://example.com"]]),
        });

        // Act
        const result = await loadConfigurationFile("FILE", NullLogger);

        // Assert
        expect(result).toEqual({
            migration: {
                mode: "all",
                mappings: new Map([["a", "https://example.com"]]),
            },
        });
    });

    it("should throw if the migration configuration loading throws", async () => {
        // Arrange
        const NullLogger = new Logger(null, true);
        jest.spyOn(FS, "readFile").mockImplementationOnce((path, cb) => {
            cb(
                null,
                Buffer.from(
                    JSON.stringify({
                        migration: {
                            mode: "all",
                            mappings: [
                                {
                                    from: ["a"],
                                    to: "https://example.com",
                                },
                            ],
                        },
                    }),
                ),
            );
        });
        jest.spyOn(
            LoadMigrationConfig,
            "loadMigrationConfig",
        ).mockImplementationOnce(() => {
            throw new Error("BOOM!");
        });

        // Act
        const underTest = loadConfigurationFile("FILE", NullLogger);

        // Assert
        await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
            `"Unable to load rc file: FILE"`,
        );
    });
});
