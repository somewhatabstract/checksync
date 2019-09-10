// @flow
import MarkerParser from "../marker-parser.js";
import Logger from "../logger.js";

const NullLogger = new Logger();

describe("MarkerParser", () => {
    describe("#getOpenMarkerIDs", () => {
        it("should give empty array when no markers parsed", () => {
            // Arrange
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            const result = parser.getOpenMarkerIDs();

            // Assert
            expect(result).toBeEmpty();
        });

        it("should list open IDs when markers have not been terminated", () => {
            // Arrange
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );
            parser.parseLine("sync-start:tag1 1234 file.js");
            parser.parseLine("sync-start:tag2 example.js");
            parser.parseLine("sync-end:tag1");

            // Act
            const result = parser.getOpenMarkerIDs();

            // Assert
            expect(result).toEqual(["tag2"]);
        });

        it("should give empty array when all markers have been terminated", () => {
            // Arrange
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );
            parser.parseLine("sync-start:tag1 1234 file.js");
            parser.parseLine("sync-start:tag2 example.js");
            parser.parseLine("sync-end:tag1");
            parser.parseLine("sync-end:tag2");

            // Act
            const result = parser.getOpenMarkerIDs();

            // Assert
            expect(result).toBeEmpty();
        });
    });

    describe("#parseLine", () => {
        it("should warn if marker never started but is ended", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-end:notstarted");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-tag \\"notstarted\\" end found, but sync-tag never started"`,
            );
        });

        it("should error if target does not exist", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                target => ({file: target, exists: false}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(errorSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Sync-tag \\"markerid\\" points to \\"target1\\", which does not exist or is a directory"`,
            );
        });

        it("should error if marker started after marker content", () => {
            // Arrange
            const errorSpy = jest.spyOn(NullLogger, "error");
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
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
                `"Sync-tag \\"markerid\\" target found after content started"`,
            );
        });

        it("should warn if target repeated for same marker", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(
                `"Ignoring duplicate target \\"target1\\" for sync-tag \\"markerid\\""`,
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
                `"Sync-tag \\"markerid\\" has no content"`,
            );
        });

        it("should call addMarker for parsed markers", () => {
            // Arrange
            const addMarker = jest.fn();
            const parser = new MarkerParser(
                target => ({file: target, exists: true}),
                addMarker,
                ["//", "#"],
                NullLogger,
            );

            // Act
            parser.parseLine("// sync-start:markerid1 target1");
            parser.parseLine("# sync-start:markerid2 9876 target2");
            parser.parseLine("// sync-start:markerid2 12345 target1");
            parser.parseLine("Some super important content!");
            parser.parseLine("# sync-end:markerid2");
            parser.parseLine("# sync-end:markerid1");

            // Assert
            expect(addMarker).toHaveBeenCalledWith(
                "markerid1",
                "1472197848",
                expect.objectContaining({
                    "0": expect.objectContaining({
                        checksum: undefined,
                        file: "target1",
                    }),
                }),
            );
            expect(addMarker).toHaveBeenCalledWith(
                "markerid2",
                "1472197848",
                expect.objectContaining({
                    "1": expect.objectContaining({
                        checksum: "9876",
                        file: "target2",
                    }),
                    "2": expect.objectContaining({
                        checksum: "12345",
                        file: "target1",
                    }),
                }),
            );
        });
    });
});
