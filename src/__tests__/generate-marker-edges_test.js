// @flow
import chalk from "chalk";
import Logger from "../logger.js";
import generateMarkerEdges from "../generate-marker-edges.js";

import type {MarkerCache, Target, Marker} from "../types.js";

describe("#generateMarkerEdges", () => {
    beforeEach(() => {
        chalk.enabled = false;
    });

    afterEach(() => {
        chalk.enabled = true;
    });

    it("should return empty sequence if cache does not contain file", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = {};
        markerCache["filea"] = null;

        // Act
        const result = Array.from(
            generateMarkerEdges("filea", markerCache, NullLogger),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should not return unfixable edges", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = {
            filea: {
                marker: ({
                    fixable: false,
                    checksum: "",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "fileb",
                        }: Target),
                    },
                }: Marker),
            },
            fileb: {
                marker: ({
                    fixable: true,
                    checksum: "",
                    targets: {
                        "1": ({
                            checksum: "1234",
                            file: "filea",
                        }: Target),
                    },
                }: Marker),
            },
        };

        // Act
        const result = Array.from(
            generateMarkerEdges("filea", markerCache, NullLogger),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should return fixable edges", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = {
            filea: {
                marker: ({
                    fixable: false,
                    checksum: "",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "fileb",
                        }: Target),
                    },
                }: Marker),
            },
            fileb: {
                marker: ({
                    fixable: true,
                    checksum: "",
                    targets: ({
                        "1": ({
                            checksum: "1234",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
            },
        };

        // Act
        const result = Array.from(
            generateMarkerEdges("fileb", markerCache, NullLogger),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: "",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
    });

    it("should report errors with one way edge where target file is missing", () => {
        // Arrange
        const NullLogger = new Logger();
        const errorSpy = jest.spyOn(NullLogger, "error");
        const markerCache: MarkerCache = {
            filea: {
                marker: ({
                    fixable: true,
                    checksum: "",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "fileb",
                        }: Target),
                    },
                }: Marker),
            },
        };

        // Act
        Array.from(generateMarkerEdges("filea", markerCache, NullLogger));

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "fileb does not contain a tag named 'marker' that points to 'filea'",
        );
    });

    it("should report errors with one way edge where target file does not reference source file", () => {
        // Arrange
        const NullLogger = new Logger();
        const errorSpy = jest.spyOn(NullLogger, "error");
        const markerCache: MarkerCache = {
            filea: {
                marker: ({
                    fixable: true,
                    checksum: "",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "fileb",
                        }: Target),
                    },
                }: Marker),
            },
            fileb: {
                marker: ({
                    fixable: true,
                    checksum: "",
                    targets: {},
                }: Marker),
            },
        };

        // Act
        Array.from(generateMarkerEdges("filea", markerCache, NullLogger));

        // Assert
        expect(errorSpy).toHaveBeenCalledWith(
            "fileb does not contain a tag named 'marker' that points to 'filea'",
        );
    });

    it("should not return edges that have matching checksums", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = {
            filea: {
                marker: ({
                    fixable: true,
                    checksum: "1234",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "fileb",
                        }: Target),
                    },
                }: Marker),
            },
            fileb: {
                marker: ({
                    fixable: true,
                    checksum: "5678",
                    targets: {
                        "1": ({
                            checksum: "1234",
                            file: "filea",
                        }: Target),
                    },
                }: Marker),
            },
        };

        // Act
        const result = Array.from(
            generateMarkerEdges("fileb", markerCache, NullLogger),
        );

        // Assert
        expect(result).toBeEmpty();
    });

    it("should return edges with mismatched checksums", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = {
            filea: {
                marker: ({
                    fixable: true,
                    checksum: "4321",
                    targets: {
                        "1": ({
                            checksum: "5678",
                            file: "fileb",
                        }: Target),
                    },
                }: Marker),
            },
            fileb: {
                marker: ({
                    fixable: true,
                    checksum: "8765",
                    targets: {
                        "1": ({
                            checksum: "1234",
                            file: "filea",
                        }: Target),
                    },
                }: Marker),
            },
        };

        // Act
        const result = Array.from(
            generateMarkerEdges("fileb", markerCache, NullLogger),
        );

        // Assert
        expect(result).toEqual([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: "4321",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
    });
});
