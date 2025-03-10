import generateErrorsForFile from "../generate-errors-for-file";

import {MarkerCache, Options} from "../types";

import * as DetermineMigration from "../determine-migration";
import {ErrorCode} from "../error-codes";

describe("#generateMarkerEdges", () => {
    it("should yield empty sequence if cache does not contain file", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {};

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should not yield checksum errors from read-only files", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                errors: [],
                readOnly: true,
                aliases: [],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                type: "local",
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            },
                        },
                    },
                },
            },
            fileb: {
                errors: [],
                readOnly: false,
                aliases: [],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                type: "local",
                                checksum: "1234",
                                target: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should yield checksum mismatch errors from files that are not read-only", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                errors: [],
                readOnly: true,
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "1234",
                        selfChecksum: "9999",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                errors: [],
                readOnly: false,
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "5678",
                        selfChecksum: "1111",
                        targets: {
                            [1]: {
                                checksum: "WRONG",
                                target: "filea",
                                declaration: "// sync-start:marker WRONG filea",
                                type: "local",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "fileb", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                code: "mismatched-checksum",
                reason: "Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made corresponding changes in the source file, if necessary (WRONG != 1234)",
                location: {line: 1},
                fix: {
                    line: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 filea",
                    declaration: "// sync-start:marker WRONG filea",
                    description:
                        "Updated checksum for sync-tag 'marker' referencing 'filea:1' from wrong to 1234.",
                },
            },
        ]);
    });

    it("should yield checksum mismatch errors from files that are not read-only, even if source target ref has no checksum", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                errors: [],
                readOnly: true,
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "1234",
                        selfChecksum: "9999",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                errors: [],
                readOnly: false,
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "5678",
                        selfChecksum: "1111",
                        targets: {
                            [1]: {
                                checksum: "",
                                target: "filea",
                                declaration: "// sync-start:marker filea",
                                type: "local",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "fileb", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                code: "mismatched-checksum",
                reason: "Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made corresponding changes in the source file, if necessary (No checksum != 1234)",
                location: {line: 1},
                fix: {
                    line: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 filea",
                    declaration: "// sync-start:marker filea",
                    description:
                        "Updated checksum for sync-tag 'marker' referencing 'filea:1' from no checksum to 1234.",
                },
            },
        ]);
    });

    it("should yield errors reported during file parsing", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [
                    {
                        markerID: "marker",
                        reason: "It's an error from a fixable file",
                        code: "error-code" as any,
                        location: {line: 10, startColumn: 5, endColumn: 10},
                    },
                ],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "1234",
                        selfChecksum: "9999",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [
                    {
                        markerID: "marker",
                        reason: "It's an error from a read-only file",
                        code: "error-code" as any,
                        location: {line: 10},
                    },
                ],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "5678",
                        selfChecksum: "1111",
                        targets: {
                            [1]: {
                                checksum: "1234",
                                target: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                                type: "local",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual(markerCache.filea.errors);
    });

    it("should exclude fileDoesNotExist errors when there is a matching migration", () => {
        // Arrange
        jest.spyOn(DetermineMigration, "determineMigration").mockReturnValue(
            "MIGRATED_TARGET",
        );
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [
                    {
                        markerID: "marker",
                        reason: "It's an error from a fixable file",
                        code: ErrorCode.fileDoesNotExist,
                        location: {line: 10, startColumn: 5, endColumn: 10},
                    },
                ],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "1234",
                        selfChecksum: "9999",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [
                    {
                        markerID: "marker",
                        reason: "It's an error from a read-only file",
                        code: "error-code" as any,
                        location: {line: 10},
                    },
                ],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "5678",
                        selfChecksum: "1111",
                        targets: {
                            [1]: {
                                checksum: "1234",
                                target: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                                type: "local",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([]);
    });

    it("should yield an error when the marker does not exist in the target file and there is no matching migration", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {},
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                code: "no-return-tag",
                location: {line: 1},
                reason: "No return tag named 'marker' in 'fileb'",
            },
        ]);
    });

    it("should yield a pending migration error when the marker does not exist in the target file but there is a matching migration", () => {
        // Arrange
        jest.spyOn(DetermineMigration, "determineMigration").mockReturnValue(
            "MIGRATED_TARGET",
        );
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {},
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                code: "pending-migration",
                fix: {
                    declaration: "// sync-start:marker 5678 fileb",
                    description:
                        "Migrated sync-tag 'marker'. Target changed from 'fileb' to 'MIGRATED_TARGET'. Checksum updated from 5678 to ",
                    line: 1,
                    text: "// sync-start:marker  MIGRATED_TARGET",
                    type: "replace",
                },
                location: {
                    line: 1,
                },
                markerID: "marker",
                reason: "No return tag named 'marker' in 'fileb'. Recommend migration to remote target 'MIGRATED_TARGET' and update checksum to .",
            },
        ]);
    });

    it("should yield a pending migration error when there is a matching migration and migration mode is 'all' for local target tag", () => {
        // Arrange
        jest.spyOn(DetermineMigration, "determineMigration").mockReturnValue(
            "MIGRATED_TARGET",
        );
        const options: Options = {
            migration: {
                mode: "all",
            },
        } as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {},
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                code: "pending-migration",
                fix: {
                    declaration: "// sync-start:marker 5678 fileb",
                    description:
                        "Migrated sync-tag 'marker'. Target changed from 'fileb' to 'MIGRATED_TARGET'. Checksum updated from 5678 to ",
                    line: 1,
                    text: "// sync-start:marker  MIGRATED_TARGET",
                    type: "replace",
                },
                location: {
                    line: 1,
                },
                markerID: "marker",
                reason: "Recommended migration to remote target 'MIGRATED_TARGET' and update checksum to .",
            },
        ]);
    });

    it("should yield a pending migration error when there is a matching migration and migration mode is 'all' for remote target tag", () => {
        // Arrange
        jest.spyOn(DetermineMigration, "determineMigration").mockReturnValue(
            "MIGRATED_TARGET",
        );
        const options: Options = {
            migration: {
                mode: "all",
            },
        } as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "https://example.com/b",
                                declaration:
                                    "// sync-start:marker 5678 https://example.com/b",
                                type: "remote",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                code: "pending-migration",
                fix: {
                    declaration:
                        "// sync-start:marker 5678 https://example.com/b",
                    description:
                        "Migrated sync-tag 'marker'. Target changed from 'https://example.com/b' to 'MIGRATED_TARGET'. Checksum updated from 5678 to ",
                    line: 1,
                    text: "// sync-start:marker  MIGRATED_TARGET",
                    type: "replace",
                },
                location: {
                    line: 1,
                },
                markerID: "marker",
                reason: "Recommended migration to remote target 'MIGRATED_TARGET' and update checksum to .",
            },
        ]);
    });

    it("should yield an error when the marker in the target file does not reference source file and there is no matching migration", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {},
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                code: "no-return-tag",
                location: {line: 1},
                reason: "No return tag named 'marker' in 'fileb'",
            },
        ]);
    });

    it("should yield an error when the marker in the target file does not reference source file and there is a matching migration", () => {
        // Arrange
        jest.spyOn(DetermineMigration, "determineMigration").mockReturnValue(
            "MIGRATED_TARGET",
        );
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {},
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                code: "pending-migration",
                fix: {
                    declaration: "// sync-start:marker 5678 fileb",
                    description:
                        "Migrated sync-tag 'marker'. Target changed from 'fileb' to 'MIGRATED_TARGET'. Checksum updated from 5678 to ",
                    line: 1,
                    text: "// sync-start:marker  MIGRATED_TARGET",
                    type: "replace",
                },
                location: {
                    line: 1,
                },
                markerID: "marker",
                reason: "No return tag named 'marker' in 'fileb'. Recommend migration to remote target 'MIGRATED_TARGET' and update checksum to .",
            },
        ]);
    });

    it("should not yield errors when checksums match for local targets", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "1234",
                        selfChecksum: "9999",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "local",
                            },
                        },
                    },
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "5678",
                        selfChecksum: "1111",
                        targets: {
                            [1]: {
                                checksum: "1234",
                                target: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                                type: "local",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "fileb", markerCache),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should yield error when self checksum does not match for remote targets", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "9999",
                        selfChecksum: "1234",
                        targets: {
                            [1]: {
                                checksum: "WRONG",
                                target: "https://fileb",
                                declaration:
                                    "// sync-start:marker WRONG https://fileb",
                                type: "remote",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                code: "mismatched-checksum",
                reason: "Looks like you changed the content of sync-tag 'marker' or the path of the file that contains the tag. Make sure you've made corresponding changes at https://fileb, if necessary (WRONG != 1234)",
                location: {line: 1},
                fix: {
                    line: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 https://fileb",
                    declaration: "// sync-start:marker WRONG https://fileb",
                    description:
                        "Updated checksum for sync-tag 'marker' referencing 'https://fileb' from wrong to 1234.",
                },
            },
        ]);
    });

    it("should yield error when tag checksum is NoChecksum for remote target", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "9999",
                        selfChecksum: "1234",
                        targets: {
                            [1]: {
                                checksum: "",
                                target: "https://fileb",
                                declaration:
                                    "// sync-start:marker https://fileb",
                                type: "remote",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                code: "mismatched-checksum",
                reason: "Looks like you changed the content of sync-tag 'marker' or the path of the file that contains the tag. Make sure you've made corresponding changes at https://fileb, if necessary (No checksum != 1234)",
                location: {line: 1},
                fix: {
                    line: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 https://fileb",
                    declaration: "// sync-start:marker https://fileb",
                    description:
                        "Updated checksum for sync-tag 'marker' referencing 'https://fileb' from no checksum to 1234.",
                },
            },
        ]);
    });

    it("should not yield errors when self checksum matches for remote target", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "9999",
                        selfChecksum: "5678",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "https://fileb",
                                declaration:
                                    "// sync-start:marker 5678 https://fileb",
                                type: "remote",
                            },
                        },
                    },
                },
            },
        };

        // Act
        const result = Array.from(
            generateErrorsForFile(options, "filea", markerCache),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should throw an error when the target type is unknown", () => {
        // Arrange
        const options: Options = {} as any;
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: {
                        commentStart: "//",
                        commentEnd: undefined,
                        contentChecksum: "",
                        selfChecksum: "",
                        targets: {
                            [1]: {
                                checksum: "5678",
                                target: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                                type: "unknown" as any,
                            },
                        },
                    },
                },
            },
        };

        // Act
        const underTest = () =>
            Array.from(generateErrorsForFile(options, "filea", markerCache));

        // Assert
        expect(underTest).toThrowErrorMatchingInlineSnapshot(
            `"Unknown target type: unknown"`,
        );
    });
});
