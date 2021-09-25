// @flow
import generateErrorsForFile from "../generate-errors-for-file.js";

import type {MarkerCache, Target, Marker, Options} from "../types.js";

describe("#generateMarkerEdges", () => {
    it("should yield empty sequence if cache does not contain file", () => {
        // Arrange
        const options: Options = ({}: any);
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
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                errors: [],
                readOnly: true,
                aliases: [],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                errors: [],
                readOnly: false,
                aliases: [],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "",
                        targets: {
                            [1]: ({
                                checksum: "1234",
                                file: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                            }: Target),
                        },
                    }: Marker),
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
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                errors: [],
                readOnly: true,
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "1234",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                errors: [],
                readOnly: false,
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "5678",
                        targets: ({
                            [1]: ({
                                checksum: "WRONG",
                                file: "filea",
                                declaration: "// sync-start:marker WRONG filea",
                            }: Target),
                        }: any),
                    }: Marker),
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
                code: "mismatched-checksum",
                reason: "Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made the parallel changes in the source file, if necessary (WRONG != 1234)",
                location: {line: 1},
                fix: {
                    line: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 filea",
                    declaration: "// sync-start:marker WRONG filea",
                    description:
                        "Updated checksum for sync-tag 'marker' referencing 'filea:1' from WRONG to 1234.",
                },
            },
        ]);
    });

    it("should yield checksum mismatch errors from files that are not read-only, even if source target ref has no checksum", () => {
        // Arrange
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                errors: [],
                readOnly: true,
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "1234",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                errors: [],
                readOnly: false,
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "5678",
                        targets: ({
                            [1]: ({
                                checksum: "",
                                file: "filea",
                                declaration: "// sync-start:marker WRONG filea",
                            }: Target),
                        }: any),
                    }: Marker),
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
                code: "mismatched-checksum",
                reason: "Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made the parallel changes in the source file, if necessary (No checksum != 1234)",
                location: {line: 1},
                fix: {
                    line: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 filea",
                    declaration: "// sync-start:marker WRONG filea",
                    description:
                        "Updated checksum for sync-tag 'marker' referencing 'filea:1' from no checksum to 1234.",
                },
            },
        ]);
    });

    it("should yield errors reported during file parsing", () => {
        // Arrange
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [
                    {
                        reason: "It's an error from a fixable file",
                        code: ("error-code": any),
                        location: {line: 10, startColumn: 5, endColumn: 10},
                    },
                ],
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "1234",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                readOnly: false,
                errors: [
                    {
                        reason: "It's an error from a read-only file",
                        code: ("error-code": any),
                        location: {line: 10},
                    },
                ],
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "5678",
                        targets: {
                            [1]: ({
                                checksum: "1234",
                                file: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                            }: Target),
                        },
                    }: Marker),
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

    it("should yield an error when the marker does not exist in the target file", () => {
        // Arrange
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
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
                code: "no-return-tag",
                location: {line: 1},
                reason: "No return tag named 'marker' in 'fileb'",
            },
        ]);
    });

    it("should yield an error when the marker in the target file does not reference source file", () => {
        // Arrange
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "",
                        targets: {},
                    }: Marker),
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
                code: "no-return-tag",
                location: {line: 1},
                reason: "No return tag named 'marker' in 'fileb'",
            },
        ]);
    });

    it("should not yield errors when checksums match", () => {
        // Arrange
        const options: Options = ({}: any);
        const markerCache: MarkerCache = {
            filea: {
                readOnly: false,
                errors: [],
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "1234",
                        targets: {
                            [1]: ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                readOnly: false,
                errors: [],
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        checksum: "5678",
                        targets: {
                            [1]: ({
                                checksum: "1234",
                                file: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                            }: Target),
                        },
                    }: Marker),
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
});
