import fs from "fs";
import os from "os";
import path from "path";

import getNormalizedPathInfo from "../get-normalized-path-info";

/**
 * Target-resolution vectors shared with the Rust implementation, which tests
 * against the same file so both resolve sync-tag targets the same way.
 *
 * The `files` and `folders` are created under a new root folder. In a target
 * or expected path, `<root>` stands for that folder and `<parent>` for the
 * folder above it. Paths are written with `/`; expected local paths are
 * compared with the platform's separators.
 */
const TABLE: {
    files: ReadonlyArray<string>;
    folders: ReadonlyArray<string>;
    vectors: ReadonlyArray<{
        description: string;
        target: string;
        expected: {path: string; exists: boolean; type: "local" | "remote"};
    }>;
} = JSON.parse(
    fs.readFileSync(
        path.join(
            __dirname,
            "../../__conformance__/normalized-path-vectors.json",
        ),
        "utf8",
    ),
);

describe("getNormalizedPathInfo vectors", () => {
    let parent: string;
    let root: string;

    /**
     * Swap the placeholders in a table value for the real folders.
     */
    const expand = (value: string): string =>
        value
            .replaceAll("<root>", () => root)
            .replaceAll("<parent>", () => parent);

    beforeEach(() => {
        parent = fs.mkdtempSync(path.join(os.tmpdir(), "path-vectors-"));
        root = path.join(parent, "root");
        for (const folder of TABLE.folders) {
            fs.mkdirSync(path.join(root, folder), {recursive: true});
        }
        for (const file of TABLE.files) {
            fs.mkdirSync(path.dirname(path.join(root, file)), {
                recursive: true,
            });
            fs.writeFileSync(path.join(root, file), "");
        }
    });

    afterEach(() => {
        fs.rmSync(parent, {recursive: true, force: true});
    });

    it.each(TABLE.vectors)(
        "should resolve what the vector expects: $description",
        ({target, expected}) => {
            // Arrange
            const expectedPath =
                expected.type === "local"
                    ? expand(expected.path).replaceAll("/", path.sep)
                    : expected.path;

            // Act
            const result = getNormalizedPathInfo(root, expand(target));

            // Assert
            expect(result).toEqual({
                path: expectedPath,
                exists: expected.exists,
                type: expected.type,
            });
        },
    );
});
