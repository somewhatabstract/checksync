// @flow

import cloneAsUnfixable from "../clone-as-unfixable.js";

import type {FileInfo} from "../types.js";

describe("#cloneAsUnfixable", () => {
    it.each([null, undefined])(
        "should return the same value if null/undefined",
        testCase => {
            // Arrange

            // Act
            const result = cloneAsUnfixable(testCase);

            // Assert
            expect(result).toBe(testCase);
        },
    );

    it("should return new object with markers set to unfixable", () => {
        // Arrange
        const fileInfo: FileInfo = {
            aliases: ["file"],
            markers: {
                marker1: {
                    fixable: true,
                    targets: {},
                    checksum: "CHECKSUM",
                    comment: "COMMENT",
                },
            },
        };

        // Act
        const result = cloneAsUnfixable(fileInfo);

        // Assert
        expect(result).toEqual({
            aliases: ["file"],
            markers: {
                marker1: {
                    fixable: false,
                    targets: {},
                    checksum: "CHECKSUM",
                    comment: "COMMENT",
                },
            },
        });
    });

    it("should share the same aliases array", () => {
        // Arrange
        const fileInfo = {
            aliases: ["file"],
            markers: {},
        };

        // Act
        const result = cloneAsUnfixable(fileInfo);

        // Assert
        expect(result && result.aliases).toBe(fileInfo.aliases);
    });
});
