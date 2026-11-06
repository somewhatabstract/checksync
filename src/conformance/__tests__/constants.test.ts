import {CLI_CASES} from "../constants";

describe("CLI_CASES", () => {
    it("should give every case a unique id so no golden file is shared", () => {
        // Arrange
        const ids = CLI_CASES.map((c) => c.id);

        // Act
        const uniqueIds = new Set(ids);

        // Assert
        expect(uniqueIds.size).toBe(ids.length);
    });

    it("should keep every case's goldens apart from the example goldens", () => {
        // Arrange
        const ids = CLI_CASES.map((c) => c.id);

        // Act
        const outsideCli = ids.filter((id) => !id.startsWith("cli/"));

        // Assert
        expect(outsideCli).toBeEmpty();
    });
});
