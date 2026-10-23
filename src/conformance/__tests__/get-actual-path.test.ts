import getActualPath from "../get-actual-path";

describe("#getActualPath", () => {
    it("should put .actual before a .txt extension", () => {
        // Arrange
        const goldenPath = "/goldens/a.json.txt";

        // Act
        const result = getActualPath(goldenPath);

        // Assert
        expect(result).toBe("/goldens/a.json.actual.txt");
    });

    it("should put .actual before a .json extension so the file keeps its type", () => {
        // Arrange
        const goldenPath = "/goldens/a.output-cache.json";

        // Act
        const result = getActualPath(goldenPath);

        // Assert
        expect(result).toBe("/goldens/a.output-cache.actual.json");
    });
});
