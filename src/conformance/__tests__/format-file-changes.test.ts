import formatFileChanges from "../format-file-changes";
import formatFileEntry from "../format-file-entry";
import {FileEntry} from "../types";

jest.mock("../format-file-entry");

const file = (content: string): FileEntry => ({
    kind: "file",
    content: Buffer.from(content, "utf8"),
});

describe("#formatFileChanges", () => {
    beforeEach(() => {
        jest.mocked(formatFileEntry).mockImplementation((entry) =>
            entry.kind === "file"
                ? `<${entry.content.toString("utf8")}>\n`
                : `<link ${entry.target}>\n`,
        );
    });

    it("should say nothing changed when the snapshots match", () => {
        // Arrange
        const before = new Map([["a.js", file("same")]]);
        const after = new Map([["a.js", file("same")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("No files changed.\n");
    });

    it("should list a changed file with its new content", () => {
        // Arrange
        const before = new Map([["a.js", file("old")]]);
        const after = new Map([["a.js", file("new")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- a.js (changed) ---\n<new>\n");
    });

    it("should leave out files whose content didn't change", () => {
        // Arrange
        const before = new Map([
            ["a.js", file("old")],
            ["b.js", file("same")],
        ]);
        const after = new Map([
            ["a.js", file("new")],
            ["b.js", file("same")],
        ]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- a.js (changed) ---\n<new>\n");
    });

    it("should list a created file with its content", () => {
        // Arrange
        const before = new Map<string, FileEntry>();
        const after = new Map([["a.txt", file("new")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- a.txt (created) ---\n<new>\n");
    });

    it("should list a deleted file without content", () => {
        // Arrange
        const before = new Map([["a.txt", file("old")]]);
        const after = new Map<string, FileEntry>();

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- a.txt (deleted) ---\n");
    });

    it("should list a symbolic link whose target changed", () => {
        // Arrange
        const before = new Map<string, FileEntry>([
            ["link.js", {kind: "symlink", target: "a.js"}],
        ]);
        const after = new Map<string, FileEntry>([
            ["link.js", {kind: "symlink", target: "b.js"}],
        ]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- link.js (changed) ---\n<link b.js>\n");
    });

    it("should leave out a symbolic link whose target didn't change", () => {
        // Arrange
        const before = new Map<string, FileEntry>([
            ["link.js", {kind: "symlink", target: "a.js"}],
        ]);
        const after = new Map<string, FileEntry>([
            ["link.js", {kind: "symlink", target: "a.js"}],
        ]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("No files changed.\n");
    });

    it("should list a symbolic link replaced by a file as changed", () => {
        // Arrange
        const before = new Map<string, FileEntry>([
            ["link.js", {kind: "symlink", target: "a.js"}],
        ]);
        const after = new Map([["link.js", file("copied")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- link.js (changed) ---\n<copied>\n");
    });

    it("should list changes in path order so goldens are stable", () => {
        // Arrange
        const before = new Map<string, FileEntry>();
        const after = new Map([
            ["b.txt", file("b")],
            ["a.txt", file("a")],
        ]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe(
            "--- a.txt (created) ---\n<a>\n--- b.txt (created) ---\n<b>\n",
        );
    });
});
