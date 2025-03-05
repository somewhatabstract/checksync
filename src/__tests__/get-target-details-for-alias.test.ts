import {getTargetDetailsForAlias} from "../get-target-details-for-alias";

describe("getTargetDetailsForAlias", () => {
    it("should return null if the marker is nullish", () => {
        // Arrange

        // Act
        const result = getTargetDetailsForAlias(null, ["alias"]);

        // Assert
        expect(result).toBeNull();
    });

    it("should return null if there is no target matching any given alias", () => {
        // Arrange

        // Act
        const result = getTargetDetailsForAlias(
            {
                contentChecksum: "checksum",
                targets: {
                    "1": {target: "target1"},
                    "2": {target: "target2"},
                },
            } as any,
            ["alias"],
        );

        // Assert
        expect(result).toBeNull();
    });

    it("should return the line number and content checksum for the first matching target of any given alias", () => {
        // Arrange
        const targetMarker = {
            contentChecksum: "checksum",
            targets: {
                "42": {target: "alias/path/two"},
                "200": {target: "target2"},
                "300": {target: "alias"},
            },
        } as any;

        // Act
        const result = getTargetDetailsForAlias(targetMarker, [
            "alias",
            "alias/path/two",
        ]);

        // Assert
        expect(result).toEqual({line: 42, checksum: "checksum"});
    });
});
