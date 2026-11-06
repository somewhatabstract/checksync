import {FileEntry} from "./types";

/**
 * Format a file entry's content so that every byte of it can be seen.
 *
 * Each line is shown as a JSON string that keeps its terminator, so line
 * endings, a missing final newline, and an empty file are all explicit. A
 * byte order mark is escaped since it would otherwise be invisible, and
 * content that isn't valid UTF-8 is shown as hex so that no byte is lost in
 * decoding.
 *
 * @param entry The entry to format.
 * @returns The formatted content, ending in a newline.
 */
export default function formatFileEntry(entry: FileEntry): string {
    if (entry.kind === "symlink") {
        return `symlink to ${JSON.stringify(entry.target)}\n`;
    }
    const text = entry.content.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(entry.content)) {
        return `(not UTF-8, hex) ${entry.content.toString("hex")}\n`;
    }
    const lines = text.match(/[^\n]*\n|[^\n]+$/g);
    if (lines == null) {
        return "(empty)\n";
    }
    return lines
        .map(
            (line) => `${JSON.stringify(line).replace(/\uFEFF/g, "\\ufeff")}\n`,
        )
        .join("");
}
