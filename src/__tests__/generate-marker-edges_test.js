// @flow
import generateMarkerEdges from "../generate-marker-edges.js";

import type {MarkerCache, Target, Marker} from "../types.js";

describe("#generateMarkerEdges", () => {
    it("should return empty sequence if cache does not contain file", () => {
        // Arrange
        const markerCache: MarkerCache = {};
        markerCache["filea"] = null;

        // Act
        const result = Array.from(generateMarkerEdges("filea", markerCache));

        // Assert
        expect(result).toBeEmpty();
    });

    it("should not return unfixable edges", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: [],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: false,
                        checksum: "",
                        targets: {
                            "1": ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                aliases: [],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "",
                        targets: {
                            "1": ({
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
        const result = Array.from(generateMarkerEdges("filea", markerCache));

        // Assert
        expect(result).toBeEmpty();
    });

    it("should return fixable edges", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: false,
                        checksum: "",
                        targets: {
                            "1": ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "",
                        targets: ({
                            "1": ({
                                checksum: "1234",
                                file: "filea",
                                declaration: "// sync-start:marker 1234 filea",
                            }: Target),
                        }: any),
                    }: Marker),
                },
            },
        };

        // Act
        const result = Array.from(generateMarkerEdges("fileb", markerCache));

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceDeclaration: "// sync-start:marker 1234 filea",
                sourceLine: "1",
                sourceCommentStart: "//",
                sourceCommentEnd: undefined,
                targetChecksum: "",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
    });

    it("should mark one way edges where target file is missing", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "",
                        targets: {
                            "1": ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
        };

        // Act
        const result = Array.from(generateMarkerEdges("filea", markerCache));

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "5678",
                sourceDeclaration: "// sync-start:marker 5678 fileb",
                sourceLine: "1",
                sourceCommentStart: "//",
                sourceCommentEnd: undefined,
                targetChecksum: undefined,
                targetFile: "fileb",
                targetLine: undefined,
            },
        ]);
    });

    it("should mark one way edges where target file is missing and source has no checksum yet", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "",
                        targets: {
                            "1": ({
                                checksum: "",
                                file: "fileb",
                                declaration: "// sync-start:marker fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
        };

        // Act
        const result = Array.from(generateMarkerEdges("filea", markerCache));

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "",
                sourceDeclaration: "// sync-start:marker fileb",
                sourceLine: "1",
                sourceCommentStart: "//",
                sourceCommentEnd: undefined,
                targetChecksum: undefined,
                targetFile: "fileb",
                targetLine: undefined,
            },
        ]);
    });

    it("should mark one way edge where target file does not reference source file", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "",
                        targets: {
                            "1": ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "",
                        targets: {},
                    }: Marker),
                },
            },
        };

        // Act
        const result = Array.from(generateMarkerEdges("filea", markerCache));

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "5678",
                sourceDeclaration: "// sync-start:marker 5678 fileb",
                sourceLine: "1",
                sourceCommentStart: "//",
                sourceCommentEnd: undefined,
                targetChecksum: undefined,
                targetFile: "fileb",
                targetLine: undefined,
            },
        ]);
    });

    it("should not return edges that have matching checksums", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "1234",
                        targets: {
                            "1": ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 5678 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "5678",
                        targets: {
                            "1": ({
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
        const result = Array.from(generateMarkerEdges("fileb", markerCache));

        // Assert
        expect(result).toBeEmpty();
    });

    it("should return edges with mismatched checksums", () => {
        // Arrange
        const markerCache: MarkerCache = {
            filea: {
                aliases: ["filea"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "4321",
                        targets: {
                            "1": ({
                                checksum: "5678",
                                file: "fileb",
                                declaration: "// sync-start:marker 4321 fileb",
                            }: Target),
                        },
                    }: Marker),
                },
            },
            fileb: {
                aliases: ["fileb"],
                markers: {
                    marker: ({
                        commentStart: "//",
                        commentEnd: undefined,
                        fixable: true,
                        checksum: "8765",
                        targets: {
                            "1": ({
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
        const result = Array.from(generateMarkerEdges("fileb", markerCache));

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceDeclaration: "// sync-start:marker 1234 filea",
                sourceLine: "1",
                sourceCommentStart: "//",
                sourceCommentEnd: undefined,
                targetChecksum: "4321",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
    });
});
