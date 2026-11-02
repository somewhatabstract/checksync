import fs from "fs";
import path from "path";

/**
 * The line_endings example only proves that checksums ignore line endings
 * while its files really use different ones. If an editor or git ever
 * normalized them, every golden file would still match, so check the bytes.
 */
const EXAMPLE_DIR = path.join(__dirname, "../../__examples__/line_endings");

/**
 * Get each distinct line ending a file uses.
 */
const getLineEndings = (file: string): Array<string> => {
    const content = fs.readFileSync(path.join(EXAMPLE_DIR, file), "utf8");
    const endings = content.match(/\r\n|\r|\n/g) ?? [];
    return [...new Set(endings)].sort();
};

describe("line_endings example", () => {
    it.each`
        file          | expected
        ${"lf.txt"}   | ${["\n"]}
        ${"crlf.txt"} | ${["\r\n"]}
        ${"cr.txt"}   | ${["\r"]}
    `(
        "should keep only $expected line endings in $file",
        ({file, expected}) => {
            // Arrange

            // Act
            const result = getLineEndings(file);

            // Assert
            expect(result).toEqual(expected);
        },
    );
});
