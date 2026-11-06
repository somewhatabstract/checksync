import formatFileEntry from "../format-file-entry";
import {FileEntry} from "../types";

const file = (content: string | Buffer): FileEntry => ({
    kind: "file",
    content: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
});

describe("#formatFileEntry", () => {
    it("should show each line as a JSON string so line endings are visible", () => {
        // Arrange
        const entry = file("one\r\ntwo\rstill two\n");

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe('"one\\r\\n"\n"two\\rstill two\\n"\n');
    });

    it("should show a final line without its newline when the file has none", () => {
        // Arrange
        const entry = file("one\ntwo");

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe('"one\\n"\n"two"\n');
    });

    it("should mark an empty file as empty", () => {
        // Arrange
        const entry = file("");

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe("(empty)\n");
    });

    it("should escape a byte order mark since it would otherwise be invisible", () => {
        // Arrange
        const entry = file("﻿text\n");

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe('"\\ufefftext\\n"\n');
    });

    it("should keep other non-ASCII text readable", () => {
        // Arrange
        const entry = file("café 🎉\n");

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe('"café 🎉\\n"\n');
    });

    it("should show content that isn't valid UTF-8 as hex so no byte is lost", () => {
        // Arrange
        const entry = file(Buffer.from([0x61, 0xff, 0x0a]));

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe("(not UTF-8, hex) 61ff0a\n");
    });

    it("should show a symbolic link's target", () => {
        // Arrange
        const entry: FileEntry = {kind: "symlink", target: "../a.js"};

        // Act
        const result = formatFileEntry(entry);

        // Assert
        expect(result).toBe('symlink to "../a.js"\n');
    });
});
