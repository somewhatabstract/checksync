// @flow
import adler32 from "adler-32";

/**
 * For backwards compatibility with the sync linter in Khan Academy's codebase,
 * we precede all content with a blank line.
 */
const DEFAULT_CONTENT = ["\n"];

export default function checksum(lines: Array<string>): string {
    const saltedContent = [...DEFAULT_CONTENT, ...lines].join("");
    return `${adler32.str(saltedContent)}`.replace("-", "");
}
