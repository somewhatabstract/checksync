import fs from "fs";

import {ErrorCode} from "../error-codes";
import Logger from "../logger";
import FileReferenceLogger from "../file-reference-logger";
import fixFile from "../fix-file";

import * as ReadLines from "../read-lines";
import * as RootRelativePath from "../root-relative-path";

import {Options} from "../types";

const _NullLogger = new Logger(null);

describe("#fixFile", () => {
    const options: Options = {
        includeGlobs: [],
        excludeGlobs: [],
        ignoreFiles: [],
        dryRun: false,
        autoFix: true,
        comments: [],
        rootMarker: null,
        json: false,
        allowEmptyTags: false,
        cachePath: "",
        cacheMode: "ignore",
    };

    it("should resolve if there are no mismatches for file", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);

        // Act
        const underTest = fixFile(options, "filea", NullFileLogger, {});

        // Assert
        await expect(underTest).resolves;
    });

    it("should log checksum mismatches", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream: any = {
            once: jest.fn<any, any>(),
            write: jest.fn<any, any>(),
            end: jest.fn<any, any>(),
        } as const;
        // @ts-expect-error no need to explicitly type all this
        jest.spyOn(fs, "truncate").mockImplementation((_, __, cb) => cb());
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation((cb: () => void) => cb());

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "BROKEN_DECLARATION",
        ]);
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const logSpy = jest.spyOn(NullFileLogger, "fix");

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    markerID: "MARKER_ID",
                    code: ErrorCode.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 1,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        await promise;

        // Assert
        expect(logSpy).toHaveBeenCalledWith("FIXES THE MISMATCH", 1);
    });

    it("should write out lines as they are if no fix required, with newline appended", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream: any = {
            once: jest.fn<any, any>(),
            write: jest.fn<any, any>(),
            end: jest.fn<any, any>(),
        } as const;
        // @ts-expect-error no need to explicitly type all this
        jest.spyOn(fs, "truncate").mockImplementation((_, __, cb) => cb());
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation((cb: () => void) => cb());

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "REGULAR_LINE",
        ]);
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const logSpy = jest.spyOn(NullFileLogger, "fix");

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    markerID: "MARKER_ID",
                    code: ErrorCode.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 1,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenCalledWith("REGULAR_LINE\n");
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("should write replacement fix lines with newline appended for mismatches", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream: any = {
            once: jest.fn<any, any>(),
            write: jest.fn<any, any>(),
            end: jest.fn<any, any>(),
        } as const;
        // @ts-expect-error no need to explicitly type all this
        jest.spyOn(fs, "truncate").mockImplementation((_, __, cb) => cb());
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation((cb: () => void) => cb());

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "BROKEN_DECLARATION",
        ]);
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    markerID: "MARKER_ID",
                    code: ErrorCode.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 1,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenCalledWith("MISMATCH FIX\n");
        expect(fakeWriteStream.write).not.toHaveBeenCalledWith(
            "BROKEN_DECLARATION\n",
        );
    });

    it("should not write anything for delete fixes", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream: any = {
            once: jest.fn<any, any>(),
            write: jest.fn<any, any>(),
            end: jest.fn<any, any>(),
        } as const;
        // @ts-expect-error no need to explicitly type all this
        jest.spyOn(fs, "truncate").mockImplementation((_, __, cb) => cb());
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation((cb: () => void) => cb());

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "BROKEN_DECLARATION",
        ]);
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    markerID: "MARKER_ID",
                    code: ErrorCode.duplicateTarget,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "delete",
                        declaration: "BROKEN_DECLARATION",
                        line: 1,
                        description: "DELETES THE LINE",
                    },
                },
            ],
        });
        await promise;

        // Assert
        expect(fakeWriteStream.write).not.toHaveBeenCalled();
    });

    it("should cope with duplicate text on autofix lines and lines not to be fixed", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream: any = {
            once: jest.fn<any, any>(),
            write: jest.fn<any, any>(),
            end: jest.fn<any, any>(),
        } as const;
        // @ts-expect-error no need to explicitly type all this
        jest.spyOn(fs, "truncate").mockImplementation((_, __, cb) => cb());
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation((cb: () => void) => cb());

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "BROKEN_DECLARATION",
            "BROKEN_DECLARATION",
            "BROKEN_DECLARATION",
        ]);
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );

        // Act
        const promise = fixFile(options, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    markerID: "MARKER_ID1",
                    code: ErrorCode.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        text: "REPLACEMENT_LINE1",
                        declaration: "BROKEN_DECLARATION",
                        line: 1,
                        description: "DELETES THE LINE",
                    },
                },
                {
                    markerID: "MARKER_ID2",
                    code: ErrorCode.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        text: "REPLACEMENT_LINE3",
                        declaration: "BROKEN_DECLARATION",
                        line: 3,
                        description: "DELETES THE LINE",
                    },
                },
            ],
        });
        await promise;

        // Assert
        expect(fakeWriteStream.write).toHaveBeenNthCalledWith(
            1,
            "REPLACEMENT_LINE1\n",
        );
        expect(fakeWriteStream.write).toHaveBeenNthCalledWith(
            3,
            "REPLACEMENT_LINE3\n",
        );
    });

    it("should not write to file during dry run", async () => {
        // Arrange
        const NullFileLogger = new FileReferenceLogger("filea", _NullLogger);
        const fakeWriteStream: any = {
            once: jest.fn<any, any>(),
            write: jest.fn<any, any>(),
            end: jest.fn<any, any>(),
        } as const;
        // @ts-expect-error no need to explicitly type all this
        jest.spyOn(fs, "truncate").mockImplementation((_, __, cb) => cb());
        fakeWriteStream.once.mockReturnValue(fakeWriteStream);
        fakeWriteStream.end.mockImplementation((cb: () => void) => cb());

        jest.spyOn(fs, "openSync").mockReturnValueOnce(0);
        jest.spyOn(fs, "createWriteStream").mockReturnValueOnce(
            fakeWriteStream,
        );
        jest.spyOn(ReadLines, "default").mockResolvedValueOnce([
            "BROKEN_DECLARATION",
        ]);
        jest.spyOn(RootRelativePath, "default").mockImplementation(
            (t) => `ROOT_REL:${t}`,
        );
        const testOptions: Options = {
            ...options,
            dryRun: true,
        };

        // Act
        const promise = fixFile(testOptions, "filea", NullFileLogger, {
            BROKEN_DECLARATION: [
                {
                    markerID: "MARKER_ID",
                    code: ErrorCode.mismatchedChecksum,
                    reason: "MISMATCHED CHECKSUMS REASON",
                    fix: {
                        type: "replace",
                        declaration: "BROKEN_DECLARATION",
                        line: 1,
                        text: "MISMATCH FIX",
                        description: "FIXES THE MISMATCH",
                    },
                },
            ],
        });

        await promise;

        // Assert
        expect(fakeWriteStream.write).not.toHaveBeenCalled();
    });
});
