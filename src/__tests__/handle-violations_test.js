// @flow
import handleViolations from "../handle-violations.js";
import Logger from "../logger.js";

import * as ReportViolation from "../report-violation.js";
import * as FixViolation from "../fix-violation.js";

import type {MarkerCache, Marker, Target} from "../types.js";

describe("#handleViolations", () => {
    it("should ignore files without markers", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({}: any);
        markerCache["filea"] = null;

        // Act
        const result = handleViolations(markerCache, false, NullLogger);

        // Assert
        expect(result).toBeEmpty();
    });

    it("should ignore markers not marked fixable", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({
            filea: {
                marker: ({
                    fixable: false,
                    checksum: "",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "afilename",
                        }: Target),
                    }: any),
                }: Marker),
            },
        }: any);

        // Act
        const result = handleViolations(markerCache, false, NullLogger);

        // Assert
        expect(result).toBeEmpty();
    });

    it("should ignore target if it is not in the cache", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({
            filea: {
                marker: ({
                    fixable: true,
                    checksum: "",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "afilename",
                        }: Target),
                    }: any),
                }: Marker),
            },
        }: any);

        // Act
        const result = handleViolations(markerCache, false, NullLogger);

        // Assert
        expect(result).toBeEmpty();
    });

    it("should ignore target if checksum matches", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({
            filea: {
                marker: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "1": ({
                            checksum: "TARGET_CHECKSUM",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
            },
            targetfile: {
                marker: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
            },
        }: any);

        // Act
        const result = handleViolations(markerCache, false, NullLogger);

        // Assert
        expect(result).toBeEmpty();
    });

    it("should return files that have checksum mismatches", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({
            filea: {
                marker1: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
                marker2: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
            },
            targetfile: {
                marker1: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
                marker2: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
            },
        }: any);

        // Act
        const result = handleViolations(markerCache, false, NullLogger);

        // Assert
        expect(result).toEqual(["filea"]);
    });

    it("should call reporter with checksum mismatches when not autofixing", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({
            filea: {
                marker1: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
                marker2: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
            },
            targetfile: {
                marker1: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
                marker2: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "1": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
            },
        }: any);
        const spy = jest.spyOn(ReportViolation, "default");

        // Act
        handleViolations(markerCache, false, NullLogger);

        // Assert
        expect(spy).toHaveBeenCalledWith(
            "marker1",
            "filea",
            "1",
            "MISMATCH!",
            "targetfile",
            "1",
            "TARGET_CHECKSUM",
            NullLogger,
        );
    });

    it("should call fixer with checksum mismatches when autofixing", () => {
        // Arrange
        const NullLogger = new Logger();
        const markerCache: MarkerCache = ({
            filea: {
                marker1: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "1": ({
                            checksum: "MISMATCH!",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
                marker2: ({
                    fixable: true,
                    checksum: "5678",
                    targets: ({
                        "8": ({
                            checksum: "MISMATCH!",
                            file: "targetfile",
                        }: Target),
                    }: any),
                }: Marker),
            },
            targetfile: {
                marker1: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "2": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
                marker2: ({
                    fixable: true,
                    checksum: "TARGET_CHECKSUM",
                    targets: ({
                        "10": ({
                            checksum: "5678",
                            file: "filea",
                        }: Target),
                    }: any),
                }: Marker),
            },
        }: any);
        const spy = jest.spyOn(FixViolation, "default");

        // Act
        handleViolations(markerCache, true, NullLogger);

        // Assert
        expect(spy).toHaveBeenCalledWith(
            "marker2",
            "filea",
            "8",
            "MISMATCH!",
            "targetfile",
            "10",
            "TARGET_CHECKSUM",
            NullLogger,
        );
    });
});
