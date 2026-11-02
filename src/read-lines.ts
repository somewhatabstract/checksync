import fs from "fs";
import {StringDecoder} from "string_decoder";

/**
 * Read a file's lines, without their line endings.
 *
 * `\r\n`, `\n` and a lone `\r` end lines, and nothing else does. A line ending
 * at the end of the file doesn't start another line, so an empty file has no
 * lines. The file is decoded as UTF-8: invalid bytes become U+FFFD, and an
 * incomplete character at the very end of the file is dropped.
 *
 * This is how checksync read files before 11.0.0, through Node.js 22's
 * readline with `crlfDelay: Infinity`. Node.js 24's readline also ends lines at
 * U+2028 and U+2029, which changed checksums for blocks containing them, so
 * checksync splits lines itself rather than using readline.
 *
 * @param file The path of the file to read.
 * @returns A promise of the file's lines, in order.
 */
export default async function readLines(file: string): Promise<Array<string>> {
    const bytes = await fs.promises.readFile(file);
    // Like readline, call write() without end(): an incomplete character at
    // the end is held back for more input that never comes, so it's dropped
    // rather than replaced with U+FFFD.
    const text = new StringDecoder("utf8").write(bytes);
    const lines = text.split(/\r\n|\n|\r/);
    // A line ending at the end of the file leaves an empty string after it,
    // which isn't a line.
    if (lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}
