import fs from "fs";
import path from "path";

import snapshotFiles from "../snapshot-files";

jest.mock("fs");

type FakeEntry =
    {kind: "file"; content: string} | {kind: "symlink"; target: string};

/**
 * Make fs report the given tree, rooted at `/scratch`.
 */
const fakeTree = (entries: Record<string, FakeEntry>): void => {
    const toRelative = (p: unknown): string =>
        path.relative("/scratch", String(p)).split(path.sep).join("/");
    const isDir = (relative: string): boolean =>
        relative === "" ||
        Object.keys(entries).some((e) => e.startsWith(`${relative}/`));
    jest.spyOn(fs, "readdirSync").mockImplementation(((p: unknown) => {
        const relative = toRelative(p);
        const prefix = relative === "" ? "" : `${relative}/`;
        const names = Object.keys(entries)
            .filter((e) => e.startsWith(prefix))
            .map((e) => e.slice(prefix.length).split("/")[0]);
        return [...new Set(names)];
    }) as any);
    jest.spyOn(fs, "lstatSync").mockImplementation(((p: unknown) => {
        const relative = toRelative(p);
        return {
            isSymbolicLink: () => entries[relative]?.kind === "symlink",
            isDirectory: () => isDir(relative),
        };
    }) as any);
    jest.spyOn(fs, "readlinkSync").mockImplementation(((p: unknown) => {
        const entry = entries[toRelative(p)];
        return entry.kind === "symlink" ? entry.target : "";
    }) as any);
    jest.spyOn(fs, "readFileSync").mockImplementation(((p: unknown) => {
        const entry = entries[toRelative(p)];
        return Buffer.from(entry.kind === "file" ? entry.content : "");
    }) as any);
};

describe("#snapshotFiles", () => {
    it("should record each file's content by its relative path", () => {
        // Arrange
        fakeTree({"a.js": {kind: "file", content: "a\n"}});

        // Act
        const result = snapshotFiles("/scratch");

        // Assert
        expect(result).toEqual(
            new Map([["a.js", {kind: "file", content: Buffer.from("a\n")}]]),
        );
    });

    it("should record files in nested directories with forward-slash paths", () => {
        // Arrange
        fakeTree({"dir/sub/b.js": {kind: "file", content: "b\n"}});

        // Act
        const result = snapshotFiles("/scratch");

        // Assert
        expect([...result.keys()]).toEqual(["dir/sub/b.js"]);
    });

    it("should record symbolic links by target rather than following them", () => {
        // Arrange
        fakeTree({"link.js": {kind: "symlink", target: "../a.js"}});

        // Act
        const result = snapshotFiles("/scratch");

        // Assert
        expect(result).toEqual(
            new Map([["link.js", {kind: "symlink", target: "../a.js"}]]),
        );
    });

    it("should not read through a symbolic link", () => {
        // Arrange
        fakeTree({"link.js": {kind: "symlink", target: "../a.js"}});
        const readFileSyncSpy = jest.spyOn(fs, "readFileSync");

        // Act
        snapshotFiles("/scratch");

        // Assert
        expect(readFileSyncSpy).not.toHaveBeenCalled();
    });
});
