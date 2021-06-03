// @flow
import MarkerParser from "../marker-parser.js";
import Logger from "../logger.js";

const NullLogger = new Logger();

describe("MarkerParser", () => {
    describe("#reportUnterminatedMarkers", () => {
        it("should report nothing when no markers parsed", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.reportUnterminatedMarkers();

            // Assert
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it("should report nothing when all markers are terminated", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );
            parser.parseLine("sync-start:tag1 1234 file.js");
            parser.parseLine("sync-start:tag2 example.js");
            parser.parseLine("sync-end:tag1");
            parser.parseLine("sync-end:tag2");

            // Act
            parser.reportUnterminatedMarkers();

            // Assert
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it("should report unterminated markers", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );
            parser.parseLine("sync-start:tag1 1234 file.js");
            parser.parseLine("sync-start:tag2 example.js");
            parser.parseLine("sync-end:tag1");

            // Act
            parser.reportUnterminatedMarkers();

            // Assert
            expect(errorSpy).toHaveBeenCalledWith(
                "Sync-start 'tag2' has no corresponding sync-end",
                2,
            );
        });
    });

    describe("#parseLine", () => {
        it("should error if sync-start is malformed", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:badstart");

            // Assert
            expect(errorSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'"`,
            );
        });

        it("should error if sync-end is malformed", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-end:");

            // Assert
            expect(errorSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Malformed sync-end: format should be 'sync-end:<label>'"`,
            );
        });

        it("should warn if marker never started but is ended", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-end:notstarted");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-end for 'notstarted' found, but there was no corresponding sync-start"`,
            );
        });

        it("should error if target does not exist", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: false}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(errorSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-start for 'markerid' points to 'target1', which does not exist or is a directory"`,
            );
        });

        it("should error if marker started after marker content", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("some content!");
            parser.parseLine("sync-start:markerid target2");

            // Assert
            expect(errorSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-start for 'markerid' found after content started"`,
            );
        });

        it("should warn if target repeated for same marker", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Duplicate target 'target1' for sync-tag 'markerid'"`,
            );
        });

        it("should warn if marker is empty", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                jest.fn(),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("sync-end:markerid");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-tag 'markerid' has no content"`,
            );
        });

        it("should error if tag id used in two different comment styles", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                jest.fn(),
                ["//", "#", "{/*"],
                NullLogger,
            );

            // Act
            parser.parseLine("# sync-start:markerid2 9876 target2");
            parser.parseLine("{/* sync-start:markerid2 12345 target1 */}");
            parser.parseLine("Some super important content!");
            parser.parseLine("# sync-end:markerid2");

            // Assert
            expect(errorSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-start tags for 'markerid2' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers."`,
            );
        });

        it("should call addMarker for parsed markers", () => {
            // Arrange
            const addMarker = jest.fn();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                ["//", "#", "{/*"],
                NullLogger,
            );

            // Act
            parser.parseLine("// sync-start:markerid1 target1");
            parser.parseLine("# sync-start:markerid2 9876 target2");
            parser.parseLine("{/* sync-start:markerid3 12345 target1 */}");
            parser.parseLine("Some super important content!");
            parser.parseLine("# sync-end:markerid3");
            parser.parseLine("# sync-end:markerid2");
            parser.parseLine("# sync-end:markerid1");

            // Assert
            expect(addMarker).toHaveBeenCalledWith(
                "markerid1",
                "1284371662",
                expect.objectContaining({
                    "1": {
                        checksum: "",
                        declaration: "// sync-start:markerid1 target1",
                        file: "target1",
                    },
                }),
                "//",
                "",
            );
            expect(addMarker).toHaveBeenCalledWith(
                "markerid2",
                "1284371662",
                expect.objectContaining({
                    "2": {
                        checksum: "9876",
                        declaration: "# sync-start:markerid2 9876 target2",
                        file: "target2",
                    },
                }),
                "#",
                "",
            );
            expect(addMarker).toHaveBeenCalledWith(
                "markerid3",
                "1284371662",
                expect.objectContaining({
                    "3": {
                        checksum: "12345",
                        declaration:
                            "{/* sync-start:markerid3 12345 target1 */}",
                        file: "target1",
                    },
                }),
                "{/*",
                " */}",
            );
        });
    });
});
