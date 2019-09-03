// @flow
import checksum from "../checksum.js";

describe("#checksum", () => {
    /**
     * Compare this test case to:
     *   https://github.com/Khan/webapp/blob/6cd1aa92b029742230543c1efb4bee291e382f25/dev/linters/code_syncing_lint_test.py#L65-L67
     */
    it("should provide expected checksum to match Khan Academy equivalent", () => {
        // Arrange
        const testLines = ["\n", "\n", "a test\n", "more test\n", "\n"];

        // Act
        const result = checksum(testLines);

        // Assert
        expect(result).toBe("1043727889");
    });
});
