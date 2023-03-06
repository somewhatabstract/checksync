// @flow
import MarkerParser from "../marker-parser.js";

describe("MarkerParser", () => {
    describe("#recordUnterminatedMarkers", () => {
        it("should record nothing when no markers parsed", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.recordUnterminatedMarkers();

            // Assert
            expect(addMarker).not.toHaveBeenCalled();
            expect(recordError).not.toHaveBeenCalled();
        });

        it("should record nothing when all markers are terminated", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );
            parser.parseLine("sync-start:tag1 1234 file.js");
            parser.parseLine("sync-start:tag2 example.js");
            parser.parseLine("const thisIs = 'some content';");
            parser.parseLine("sync-end:tag1");
            parser.parseLine("sync-end:tag2");

            // Act
            parser.recordUnterminatedMarkers();

            // Assert
            expect(recordError).not.toHaveBeenCalled();
        });

        it("should record unterminated markers", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );
            parser.parseLine("sync-start:tag1 1234 file.js");
            parser.parseLine("sync-start:tag2 example.js");
            parser.parseLine("sync-end:tag1");

            // Act
            parser.recordUnterminatedMarkers();

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "start-tag-witout-end-tag",
                location: {line: 2},
                reason: "Sync-start 'tag2' has no corresponding sync-end",
            });
        });
    });

    describe("#parseLine", () => {
        it("should record error if sync-start is malformed", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-start:badstart");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "malformed-start-tag",
                location: {line: 1},
                reason: "Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'",
            });
        });

        it("should record error if sync-end is malformed", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-end:");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "malformed-end-tag",
                location: {line: 1},
                reason: "Malformed sync-end: format should be 'sync-end:<label>'",
            });
        });

        it("should record error if marker never started but is ended", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-end:notstarted");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "end-tag-without-start-tag",
                location: {line: 1},
                reason: "Sync-end for 'notstarted' found, but there was no corresponding sync-start",
            });
        });

        it("should record error if target does not exist", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: false}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "file-does-not-exist",
                location: {line: 1},
                reason: "Sync-start for 'markerid' points to 'target1', which does not exist or is a directory",
            });
        });

        it("should record error if marker started after marker content", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("some content!");
            parser.parseLine("sync-start:markerid target2");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "start-tag-after-content",
                location: {line: 3},
                reason: "Sync-start for 'markerid' found after content started",
            });
        });

        it("should record error if target repeated for same marker", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "duplicate-target",
                location: {line: 2},
                reason: "Duplicate target for sync-tag 'markerid'",
                fix: {
                    declaration: "sync-start:markerid target1",
                    description:
                        "Removed duplicate target for sync-tag 'markerid'",
                    line: 2,
                    type: "delete",
                },
            });
        });

        it("should record error if marker is empty", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                [],
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("sync-end:markerid");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "empty-marker",
                location: {line: 2},
                reason: "Sync-tag 'markerid' has no content",
            });
        });

        it("should record error if tag id used in two different comment styles", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                ["//", "#", "{/*"],
            );

            // Act
            parser.parseLine("# sync-start:markerid2 9876 target2");
            parser.parseLine("{/* sync-start:markerid2 12345 target1 */}");
            parser.parseLine("Some super important content!");
            parser.parseLine("# sync-end:markerid2");

            // Assert
            expect(recordError).toHaveBeenCalledWith({
                code: "different-comment-syntax",
                location: {line: 2},
                reason: "Sync-start tags for 'markerid2' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers.",
            });
        });

        it("should call addMarker for parsed markers", () => {
            // Arrange
            const addMarker = jest.fn<any, any>();
            const recordError = jest.fn<any, any>();
            const parser = new MarkerParser(
                (target) => ({file: target, exists: true}),
                addMarker,
                recordError,
                ["//", "#", "{/*"],
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
