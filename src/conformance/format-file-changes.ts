import {FileEntry, FileSnapshot} from "./types";

/**
 * Whether two entries for the same path are identical.
 */
const isSameEntry = (a: FileEntry, b: FileEntry): boolean =>
    a.kind === "file" && b.kind === "file"
        ? a.content.equals(b.content)
        : a.kind === "symlink" && b.kind === "symlink" && a.target === b.target;

/**
 * Format an entry's content with every byte of it visible.
 *
 * Each line is shown as a JSON string that keeps its terminator, so line
 * endings, a missing final newline, and an empty file are all explicit.
 */
const formatEntry = (entry: FileEntry): string => {
    if (entry.kind === "symlink") {
        return `symlink to ${JSON.stringify(entry.target)}\n`;
    }
    const lines = entry.content.toString("utf8").match(/[^\n]*\n|[^\n]+$/g);
    if (lines == null) {
        return "(empty)\n";
    }
    return lines.map((line) => `${JSON.stringify(line)}\n`).join("");
};

/**
 * Format the differences between two snapshots of a directory tree.
 *
 * Each created or changed path is listed with its new content, and each
 * deleted path is listed on its own, in path order.
 *
 * @param before The snapshot taken before the run.
 * @param after The snapshot taken after the run.
 * @returns The formatted changes, or a line saying that nothing changed.
 */
export default function formatFileChanges(
    before: FileSnapshot,
    after: FileSnapshot,
): string {
    const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
    const sections = paths.flatMap((filePath) => {
        const was = before.get(filePath);
        const now = after.get(filePath);
        if (now == null) {
            return [`--- ${filePath} (deleted) ---\n`];
        }
        if (was == null) {
            return [`--- ${filePath} (created) ---\n${formatEntry(now)}`];
        }
        if (isSameEntry(was, now)) {
            return [];
        }
        return [`--- ${filePath} (changed) ---\n${formatEntry(now)}`];
    });
    return sections.length === 0 ? "No files changed.\n" : sections.join("");
}
