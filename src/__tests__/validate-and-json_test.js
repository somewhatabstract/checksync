// @flow
import validateAndJson from "../validate-and-json.js";
import * as GenerateMarkerEdges from "../generate-marker-edges.js";

import type {Options} from "../types.js";

jest.mock("../generate-marker-edges.js");

describe("#validateAndJson", () => {
    const options: Options = {
        includeGlobs: [],
        excludeGlobs: [],
        dryRun: false,
        autoFix: false,
        comments: [],
        rootMarker: null,
        json: false,
    };

    it("should report checksum mismatch violation", () => {
        // Arrange
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

        // Act
        const result = validateAndJson(options, "fileb", {});

        // Assert
        expect(result).toMatchInlineSnapshot(`
            Array [
              Object {
                "fix": "undefined sync-start:marker 4321 filea",
                "message": "fileb:1 Updating checksum for sync-tag 'marker' referencing 'filea:1' from 1234 to 4321.",
                "sourceFile": "fileb",
                "sourceLine": 1,
                "targetFile": "filea",
                "targetLine": 1,
                "type": "violation",
              },
            ]
        `);
    });

    it("should report no checksum if source checksum absent", () => {
        // Arrange
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

        // Act
        const result = validateAndJson(options, "fileb", {});

        // Assert
        expect(result).toMatchInlineSnapshot(`
            Array [
              Object {
                "fix": "undefined sync-start:marker 1234 filea",
                "message": "fileb:1 Updating checksum for sync-tag 'marker' referencing 'filea:1' from No checksum to 1234.",
                "sourceFile": "fileb",
                "sourceLine": 1,
                "targetFile": "filea",
                "targetLine": 1,
                "type": "violation",
              },
            ]
        `);
    });

    it("should report no checksum if target checksum absent", () => {
        // Arrange
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

        // Act
        const result = validateAndJson(options, "fileb", {});

        // Assert
        expect(result).toMatchInlineSnapshot(`
            Array [
              Object {
                "fix": "undefined sync-start:marker  filea",
                "message": "fileb:1 Updating checksum for sync-tag 'marker' referencing 'filea:1' from 1234 to .",
                "sourceFile": "fileb",
                "sourceLine": 1,
                "targetFile": "filea",
                "targetLine": 1,
                "type": "violation",
              },
            ]
        `);
    });

    it("should report an error if the target of the tag does not exist", () => {
        // Arrange
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: undefined,
                targetFile: "filea",
                targetLine: undefined,
            },
        ]);

        // Act
        const result = validateAndJson(options, "fileb", {});

        // Assert
        expect(result).toMatchInlineSnapshot(`
            Array [
              Object {
                "message": "filea does not contain a tag named 'marker' that points to 'fileb",
                "sourceFile": "fileb",
                "targetFile": "filea",
                "type": "error",
              },
            ]
        `);
    });

    it("should report an error if the target of the tag does not exist", () => {
        // Arrange
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([
            {
                markerID: "marker",
                sourceChecksum: "1234",
                sourceLine: "1",
                targetChecksum: undefined,
                targetFile: "filea",
                targetLine: undefined,
            },
        ]);

        // Act
        const result = validateAndJson(options, "fileb", {});

        // Assert
        expect(result).toMatchInlineSnapshot(`
            Array [
              Object {
                "message": "filea does not contain a tag named 'marker' that points to 'fileb",
                "sourceFile": "fileb",
                "targetFile": "filea",
                "type": "error",
              },
            ]
        `);
    });

    it("should report nothing if file has no mismatches or errors", () => {
        // Arrange
        jest.spyOn(GenerateMarkerEdges, "default").mockReturnValue([]);

        // Act
        const result = validateAndJson(options, "fileb", {});

        // Assert
        expect(result).toMatchInlineSnapshot(`Array []`);
    });
});
