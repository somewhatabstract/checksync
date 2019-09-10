// @flow
import MarkerParser from "../marker-parser.js";
import Logger from "../logger.js";

const NullLogger = new Logger();

describe("MarkerParser", () => {
    describe("#getOpenMarkerIDs", () => {
        it("should give empty array when no markers parsed", () => {
            // Arrange
            const parser = new MarkerParser(
                target => target,
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
                target => target,
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
                target => target,
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
                target => target,
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-end:notstarted");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
                "Marker end found, but marker never started:
                    Marker: notstarted"
            `);
        });

        it("should warn if marker started after marker content", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                target => target,
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("some content!");
            parser.parseLine("sync-start:markerid target2");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
                "Additional target found for marker after content started - ignoring:
                    Marker: markerid
                    Target: target2"
            `);
        });

        it("should warn if target repeated for same marker", () => {
            // Arrange
            const warnSpy = jest.spyOn(NullLogger, "warn");
            const parser = new MarkerParser(
                target => target,
                jest.fn(),
                [],
                NullLogger,
            );

            // Act
            parser.parseLine("sync-start:markerid target1");
            parser.parseLine("sync-start:markerid target1");

            // Assert
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
                "Target listed multiple times for same marker - ignoring:
                    Marker: markerid
                    Target: target1"
            `);
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
            expect(warnSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
                "Marker has no content:
                    Marker: markerid"
            `);
        });

        it("should call addMarker for parsed markers", () => {
            // Arrange
            const addMarker = jest.fn();
            const parser = new MarkerParser(
                target => target,
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
