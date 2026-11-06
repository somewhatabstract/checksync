import fs from "fs";
import os from "os";
import path from "path";

import Logger from "../logger";
import getFiles from "../get-files";

/**
 * File-discovery vectors shared with the Rust implementation, which tests
 * against the same file so both find the same files.
 *
 * The `files`, with their contents, and the `symlinks`, each pointing at a
 * relative target, are created under a new root folder. Each vector runs from
 * its `cwd`, relative to that root, and its expected files are relative to
 * the root, use `/`, and are in the order `getFiles` returns them.
 */
const TABLE: {
    files: Record<string, string>;
    symlinks: Record<string, string>;
    vectors: ReadonlyArray<{
        description: string;
        cwd: string;
        include: ReadonlyArray<string>;
        exclude: ReadonlyArray<string>;
        ignoreFiles: ReadonlyArray<string>;
        expected: ReadonlyArray<string>;
    }>;
} = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../../__conformance__/file-vectors.json"),
        "utf8",
    ),
);

describe("getFiles vectors", () => {
    const originalCwd = process.cwd();
    let root: string;

    beforeAll(() => {
        // The file walk waits on real timers, which the global fake timers
        // would stop.
        jest.useRealTimers();
        root = fs.mkdtempSync(path.join(os.tmpdir(), "file-vectors-"));
        for (const [file, contents] of Object.entries(TABLE.files)) {
            fs.mkdirSync(path.dirname(path.join(root, file)), {
                recursive: true,
            });
            fs.writeFileSync(path.join(root, file), contents);
        }
        for (const [link, target] of Object.entries(TABLE.symlinks)) {
            const linkPath = path.join(root, link);
            fs.mkdirSync(path.dirname(linkPath), {recursive: true});
            const isFolder = fs
                .statSync(path.resolve(path.dirname(linkPath), target))
                .isDirectory();
            fs.symlinkSync(target, linkPath, isFolder ? "dir" : "file");
        }
    });

    afterEach(() => {
        process.chdir(originalCwd);
    });

    afterAll(() => {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it.each(TABLE.vectors)(
        "should find what the vector expects: $description",
        async ({cwd, include, exclude, ignoreFiles, expected}) => {
            // Arrange
            process.chdir(path.join(root, cwd));

            // Act
            const files = await getFiles(
                include,
                exclude,
                ignoreFiles,
                new Logger(null),
            );
            const result = files.map((file) =>
                path.relative(root, file).split(path.sep).join("/"),
            );

            // Assert
            expect(result).toEqual(expected);
        },
    );
});
