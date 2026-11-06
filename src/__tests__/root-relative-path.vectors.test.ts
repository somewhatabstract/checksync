import fs from "fs";
import os from "os";
import path from "path";

import rootRelativePath from "../root-relative-path";

/**
 * Root-relative path vectors shared with the Rust implementation, which tests
 * against the same file so both work out root-relative paths the same way.
 *
 * Each of the `markers` is created under a new root folder, as an empty file,
 * or as a folder when it ends with `/`, and `<root>` stands for that folder. A
 * `null` marker means the default. Paths are written with `/`. An expected
 * path is compared with the platform's separators, except for a relative file
 * path, which comes back as given; an expected error message also shows the
 * file path as given.
 */
const TABLE: {
    markers: ReadonlyArray<string>;
    vectors: ReadonlyArray<{
        description: string;
        file: string;
        marker: string | null;
        expected: {path: string} | {error: string};
    }>;
} = JSON.parse(
    fs.readFileSync(
        path.join(
            __dirname,
            "../../__conformance__/root-relative-path-vectors.json",
        ),
        "utf8",
    ),
);

describe("rootRelativePath vectors", () => {
    let parent: string;
    let root: string;

    beforeEach(() => {
        parent = fs.mkdtempSync(path.join(os.tmpdir(), "root-vectors-"));
        root = path.join(parent, "root");
        for (const marker of TABLE.markers) {
            if (marker.endsWith("/")) {
                fs.mkdirSync(path.join(root, marker), {recursive: true});
            } else {
                fs.mkdirSync(path.dirname(path.join(root, marker)), {
                    recursive: true,
                });
                fs.writeFileSync(path.join(root, marker), "");
            }
        }
    });

    afterEach(() => {
        fs.rmSync(parent, {recursive: true, force: true});
    });

    it.each(TABLE.vectors)(
        "should give what the vector expects: $description",
        ({file, marker, expected}) => {
            // Arrange
            const filePath = file.replaceAll("<root>", () => root);
            const asGiven = !file.startsWith("<root>");
            const want =
                "path" in expected
                    ? {
                          path: asGiven
                              ? expected.path
                              : expected.path.replaceAll("/", path.sep),
                      }
                    : {error: expected.error.replaceAll("<root>", () => root)};

            // Act
            let result: {path: string} | {error: string};
            try {
                result = {path: rootRelativePath(filePath, marker)};
            } catch (e) {
                result = {error: (e as Error).message};
            }

            // Assert
            expect(result).toEqual(want);
        },
    );
});
