// @flow
import validateAndReport from "../validate-and-report.js";
import Logger from "../logger.js";
import * as GenerateMarkerEdges from "../generate-marker-edges.js";

import type {Options} from "../types.js";

jest.mock("../generate-marker-edges.js");

describe("#validateAndReport", () => {
    const options: Options = {
        includeGlobs: [],
        excludeGlobs: [],
        dryRun: false,
        autoFix: false,
        comments: [],
        rootMarker: null,
        json: false,
        silent: false,
    };

    it("should report violation", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: "4321",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
        const logSpy = jest.spyOn(NullLogger, "log");

        // Act
        await validateAndReport(options, "fileb", {}, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            " MISMATCH  fileb:1 Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made the parallel changes in the source file, if necessary (1234 != 4321)",
        );
    });

    it("should report no checksum if source checksum absent", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "marker",
                sourceChecksum: "",
                sourceLine: "1",
                targetChecksum: "1234",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
        const logSpy = jest.spyOn(NullLogger, "log");

        // Act
        await validateAndReport(options, "fileb", {}, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            " MISMATCH  fileb:1 Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made the parallel changes in the source file, if necessary (No checksum != 1234)",
        );
    });

    it("should report no checksum if target checksum absent", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: "",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);
        const logSpy = jest.spyOn(NullLogger, "log");

        // Act
        await validateAndReport(options, "fileb", {}, NullLogger);

        // Assert
        expect(logSpy).toHaveBeenCalledWith(
            " MISMATCH  fileb:1 Looks like you changed the target content for sync-tag 'marker' in 'filea:1'. Make sure you've made the parallel changes in the source file, if necessary (1234 != No checksum)",
        );
    });

    it("should return true if file has no mismatches", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([]);

        // Act
        const result = await validateAndReport(
            options,
            "fileb",
            {},
            NullLogger,
        );

        // Assert
        expect(result).toBeTrue();
    });

    it("should return false if file has mismatches", async () => {
        // Arrange
        const NullLogger = new Logger();
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: "1235",
                targetFile: "filea",
                targetLine: "1",
            },
        ]);

        // Act
        const result = await validateAndReport(
            options,
            "fileb",
            {},
            NullLogger,
        );

        // Assert
        expect(result).toBeFalse();
    });
});
