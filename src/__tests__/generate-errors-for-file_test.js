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
                location: {
                    end: {line: 1},
                    start: {line: 1},
                },
                fix: {
                    end: 1,
                    start: 1,
                    type: "replace",
                    text: "// sync-start:marker 1234 filea",
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
                        location: {
                            start: {line: 1, column: 5},
                            end: {line: 1, column: 10},
                        },
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
                        location: {
                            start: {line: 10},
                            end: {line: 10},
                        },
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

    it("should yield an error when the target file does not reference source file", () => {
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
                location: {
                    start: {line: 1},
                    end: {line: 1},
                },
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
