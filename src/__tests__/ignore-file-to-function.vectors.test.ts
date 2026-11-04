import fs from "fs";
import os from "os";
import path from "path";

import Logger from "../logger";
import ignoreFileToFunction from "../ignore-file-to-function";

/**
 * What an ignore file decides about a path.
 */
type Decision = "ignored" | "unignored" | "none";

/**
 * Ignore-file vectors shared with the Rust implementation, which tests against
 * the same file so both apply ignore files identically.
 *
 * Each vector's `ignoreFile` is written to a `.gitignore` in a new folder, and
 * each path is relative to that folder, using `/`.
 */
const VECTORS: ReadonlyArray<{
    description: string;
    ignoreFile: string;
    paths: ReadonlyArray<{path: string; result: Decision}>;
}> = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../../__conformance__/ignore-vectors.json"),
        "utf8",
    ),
);

/**
 * Turn the predicate's answer into the vector table's terms.
 */
const toDecision = (allowed: boolean | undefined): Decision =>
    allowed === false ? "ignored" : allowed === true ? "unignored" : "none";

describe("ignoreFileToFunction vectors", () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "ignore-vectors-"));
    });

    afterEach(() => {
        fs.rmSync(dir, {recursive: true, force: true});
    });

    it.each(VECTORS)(
        "should decide what the vector expects: $description",
        async ({ignoreFile, paths}) => {
            // Arrange
            const ignoreFilePath = path.join(dir, ".gitignore");
            fs.writeFileSync(ignoreFilePath, ignoreFile);
            const isAllowed = await ignoreFileToFunction(
                ignoreFilePath,
                new Logger(null),
            );

            // Act
            const result = paths.map(({path: p}) => ({
                path: p,
                result: toDecision(isAllowed(path.join(dir, p))),
            }));

            // Assert
            expect(result).toEqual(paths);
        },
    );
});
