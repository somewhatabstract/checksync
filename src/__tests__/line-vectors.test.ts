import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";

/**
 * One piece of a vector's bytes: UTF-8 text (optionally repeated) or raw
 * bytes in hex, for input that isn't valid UTF-8.
 */
type Part = {text: string; repeat?: number} | {hex: string};

/**
 * Bytes or text written as a plain string or as a list of parts.
 */
type Parts = string | ReadonlyArray<Part>;

/**
 * Line-splitting vectors shared with the Rust implementation, which tests
 * against the same file so both read files into identical lines.
 */
const VECTORS: ReadonlyArray<{
    description: string;
    input: Parts;
    lines: ReadonlyArray<{text: Parts; ending: string}>;
}> = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../../__conformance__/line-vectors.json"),
        "utf8",
    ),
);

/**
 * Join parts into the bytes they describe.
 */
const toBuffer = (parts: Parts): Buffer =>
    typeof parts === "string"
        ? Buffer.from(parts, "utf8")
        : Buffer.concat(
              parts.map((part) =>
                  "hex" in part
                      ? Buffer.from(part.hex, "hex")
                      : Buffer.from(part.text.repeat(part.repeat ?? 1), "utf8"),
              ),
          );

/**
 * Read a file's lines the way parseFile does: a file stream into readline
 * with crlfDelay: Infinity, so line breaks and decoding match exactly.
 */
const readLines = async (bytes: Buffer): Promise<Array<string>> => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "line-vectors-"));
    const file = path.join(dir, "input");
    fs.writeFileSync(file, bytes);
    try {
        const lines: Array<string> = [];
        await new Promise<void>((resolve) => {
            readline
                .createInterface({
                    input: fs.createReadStream(file, {
                        fd: fs.openSync(file, "r"),
                    }),
                    crlfDelay: Infinity,
                })
                .on("line", (line: string) => lines.push(line))
                .on("close", resolve);
        });
        return lines;
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
};

describe("line vectors", () => {
    it.each(VECTORS)(
        "should read the lines the vector expects: $description",
        async ({input, lines}) => {
            // Arrange
            const bytes = toBuffer(input);

            // Act
            const result = await readLines(bytes);

            // Assert
            // readline drops line endings, so only the text can be checked
            // here; the Rust tests check each line's ending.
            expect(result).toEqual(
                lines.map(({text}) => toBuffer(text).toString("utf8")),
            );
        },
    );
});
