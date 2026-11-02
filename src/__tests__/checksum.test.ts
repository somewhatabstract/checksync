import fs from "fs";
import path from "path";

import checksum from "../checksum";

/**
 * Checksum vectors shared with the Rust implementation, which tests against
 * the same file so both produce identical checksums.
 */
const VECTORS: ReadonlyArray<{
    description: string;
    lines: ReadonlyArray<string>;
    checksum: string;
}> = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../../__conformance__/checksum-vectors.json"),
        "utf8",
    ),
);

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

    it("should strip leading - if present", () => {
        // Arrange
        const testLines = ["Some super important content!"];

        // Act
        const result = checksum(testLines);

        // Assert
        expect(result).toBe("1472197848");
    });

    it.each(VECTORS)(
        "should match the shared checksum vector: $description",
        ({lines, checksum: expected}) => {
            // Arrange

            // Act
            const result = checksum(lines);

            // Assert
            expect(result).toBe(expected);
        },
    );
});
