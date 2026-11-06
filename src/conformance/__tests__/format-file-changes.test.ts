import formatFileChanges from "../format-file-changes";
import {FileEntry} from "../types";

const file = (content: string): FileEntry => ({
    kind: "file",
    content: Buffer.from(content, "utf8"),
});

describe("#formatFileChanges", () => {
    it("should say nothing changed when the snapshots match", () => {
        // Arrange
        const before = new Map([["a.js", file("same\n")]]);
        const after = new Map([["a.js", file("same\n")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("No files changed.\n");
    });

    it("should leave out files whose content didn't change", () => {
        // Arrange
        const before = new Map([
            ["a.js", file("old\n")],
            ["b.js", file("same\n")],
        ]);
        const after = new Map([
            ["a.js", file("new\n")],
            ["b.js", file("same\n")],
        ]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe('--- a.js (changed) ---\n"new\\n"\n');
    });

    it("should show each line as a JSON string so line endings are visible", () => {
        // Arrange
        const before = new Map([["a.txt", file("old")]]);
        const after = new Map([["a.txt", file("one\r\ntwo\rstill two\n")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe(
            '--- a.txt (changed) ---\n"one\\r\\n"\n"two\\rstill two\\n"\n',
        );
    });

    it("should show a final line without its newline when the file has none", () => {
        // Arrange
        const before = new Map([["a.txt", file("old\n")]]);
        const after = new Map([["a.txt", file("one\ntwo")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe('--- a.txt (changed) ---\n"one\\n"\n"two"\n');
    });

    it("should mark an emptied file as empty", () => {
        // Arrange
        const before = new Map([["a.txt", file("old\n")]]);
        const after = new Map([["a.txt", file("")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- a.txt (changed) ---\n(empty)\n");
    });

    it("should list a created file with its content", () => {
        // Arrange
        const before = new Map<string, FileEntry>();
        const after = new Map([["a.txt", file("new\n")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe('--- a.txt (created) ---\n"new\\n"\n');
    });

    it("should list a deleted file without content", () => {
        // Arrange
        const before = new Map([["a.txt", file("old\n")]]);
        const after = new Map<string, FileEntry>();

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe("--- a.txt (deleted) ---\n");
    });

    it("should show a symbolic link's new target when it changes", () => {
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
        expect(result).toBe('--- link.js (changed) ---\nsymlink to "b.js"\n');
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

    it("should show a symbolic link replaced by a file as a change", () => {
        // Arrange
        const before = new Map<string, FileEntry>([
            ["link.js", {kind: "symlink", target: "a.js"}],
        ]);
        const after = new Map([["link.js", file("copied\n")]]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe('--- link.js (changed) ---\n"copied\\n"\n');
    });

    it("should list changes in path order so goldens are stable", () => {
        // Arrange
        const before = new Map<string, FileEntry>();
        const after = new Map([
            ["b.txt", file("b\n")],
            ["a.txt", file("a\n")],
        ]);

        // Act
        const result = formatFileChanges(before, after);

        // Assert
        expect(result).toBe(
            '--- a.txt (created) ---\n"a\\n"\n--- b.txt (created) ---\n"b\\n"\n',
        );
    });
});
