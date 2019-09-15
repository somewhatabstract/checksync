// @flow
import processCache from "../process-cache.js";
import Logger from "../logger.js";
import ErrorCodes from "../error-codes.js";

import * as ValidateAndReport from "../validate-and-report.js";
import * as ValidateAndFix from "../validate-and-fix.js";

import type {MarkerCache, Marker, Target} from "../types.js";

describe("#processCache", () => {
    describe("autofix is false", () => {
        it("should call validateAndReport for each file when not autofixing", async () => {
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
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                    marker2: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "1": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
            const spy = jest
                .spyOn(ValidateAndReport, "default")
                .mockReturnValue(Promise.resolve(true));

            // Act
            await processCache(markerCache, false, NullLogger);

            // Assert
            expect(spy).toHaveBeenCalledWith("filea", markerCache, NullLogger);
            expect(spy).toHaveBeenCalledWith("fileb", markerCache, NullLogger);
        });

        it("should return ErrorCodes.SUCCESS if all files are valid", async () => {
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
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                    marker2: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "8": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(true),
            );

            // Act
            const result = await processCache(markerCache, false, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should return ErrorCodes.DESYNCHRONIZED_BLOCKS if some files are invalid", async () => {
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
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                    marker2: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "8": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(false),
            );

            // Act
            const result = await processCache(markerCache, false, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.DESYNCHRONIZED_BLOCKS);
        });

        it("should output guidance if syntax is valid but blocks mismatch", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            const groupSpy = jest.spyOn(NullLogger, "group");
            const markerCache: MarkerCache = ({
                filea: {
                    marker1: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "1": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
                },
            }: any);
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(false),
            );

            // Act
            await processCache(markerCache, false, NullLogger);

            // Assert
            expect(groupSpy).toHaveBeenCalledWith(
                "\n🛠  Desynchronized blocks detected. Check them and update as required before resynchronizing:",
            );
            expect(logSpy).toHaveBeenCalledWith("checksync -u filea fileb");
        });

        it("should output guidance if syntax errors and blocks mismatch", async () => {
            // Arrange
            const NullLogger = new Logger();
            const logSpy = jest.spyOn(NullLogger, "log");
            const groupSpy = jest.spyOn(NullLogger, "group");
            const markerCache: MarkerCache = ({
                filea: {
                    marker1: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "1": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
                },
            }: any);
            jest.spyOn(ValidateAndReport, "default").mockReturnValue(
                Promise.resolve(false),
            );

            // Act
            NullLogger.error("This was an error during parsing!");
            await processCache(markerCache, false, NullLogger);

            // Assert
            expect(groupSpy).toHaveBeenCalledWith(
                "\n🛑  Desynchronized blocks detected and parsing errors found. Fix the errors, update the blocks, then update the sync-start tags using:",
            );
            expect(logSpy).toHaveBeenCalledWith("checksync -u filea fileb");
        });
    });

    describe("autofix is true", () => {
        it("should call validateAndFix for each file", async () => {
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
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                    marker2: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "8": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
            const spy = jest
                .spyOn(ValidateAndFix, "default")
                .mockReturnValue(Promise.resolve(true));

            // Act
            await processCache(markerCache, true, NullLogger);

            // Assert
            expect(spy).toHaveBeenCalledWith("filea", markerCache, NullLogger);
            expect(spy).toHaveBeenCalledWith("fileb", markerCache, NullLogger);
        });

        it("should return ErrorCodes.SUCCESS if no files were fixed", async () => {
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
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                    marker2: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "8": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(true),
            );

            // Act
            const result = await processCache(markerCache, true, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });

        it("should return ErrorCodes.SUCCESS if files were fixed", async () => {
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
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                    marker2: ({
                        fixable: true,
                        checksum: "5678",
                        targets: ({
                            "8": ({
                                checksum: "MISMATCH!",
                                file: "fileb",
                            }: Target),
                        }: any),
                    }: Marker),
                },
                fileb: {
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
            jest.spyOn(ValidateAndFix, "default").mockReturnValue(
                Promise.resolve(false),
            );

            // Act
            const result = await processCache(markerCache, true, NullLogger);

            // Assert
            expect(result).toBe(ErrorCodes.SUCCESS);
        });
    });
});
