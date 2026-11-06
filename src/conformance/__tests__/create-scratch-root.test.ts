import fs from "fs";
import os from "os";
import path from "path";

import createScratchRoot from "../create-scratch-root";

jest.mock("fs");

describe("#createScratchRoot", () => {
    beforeEach(() => {
        jest.spyOn(os, "tmpdir").mockReturnValue("/tmp");
        jest.spyOn(fs, "mkdtempSync").mockReturnValue(
            "/tmp/checksync-conformance-abc",
        );
        jest.spyOn(fs, "realpathSync").mockReturnValue(
            "/real/checksync-conformance-abc" as any,
        );
    });

    it("should create a uniquely named directory in the temp directory", () => {
        // Arrange
        const mkdtempSyncSpy = jest.spyOn(fs, "mkdtempSync");

        // Act
        createScratchRoot("/repo", "an_example");

        // Assert
        expect(mkdtempSyncSpy).toHaveBeenCalledWith(
            path.join("/tmp", "checksync-conformance-"),
        );
    });

    it("should return the real path since that is the working directory checksync reports", () => {
        // Arrange

        // Act
        const result = createScratchRoot("/repo", "an_example");

        // Assert
        expect(result).toBe("/real/checksync-conformance-abc");
    });

    it.each(["package.json", ".checksyncrc.json", ".gitignore"])(
        "should copy the root's %s since it affects how examples are checked",
        (file) => {
            // Arrange
            const copyFileSyncSpy = jest.spyOn(fs, "copyFileSync");

            // Act
            createScratchRoot("/repo", "an_example");

            // Assert
            expect(copyFileSyncSpy).toHaveBeenCalledWith(
                path.join("/repo", file),
                path.join("/real/checksync-conformance-abc", file),
            );
        },
    );

    it("should copy the example to the same root-relative path, keeping symbolic links", () => {
        // Arrange
        const cpSyncSpy = jest.spyOn(fs, "cpSync");

        // Act
        createScratchRoot("/repo", "an_example");

        // Assert
        expect(cpSyncSpy).toHaveBeenCalledWith(
            path.join("/repo", "__examples__", "an_example"),
            path.join(
                "/real/checksync-conformance-abc",
                "__examples__",
                "an_example",
            ),
            {recursive: true, verbatimSymlinks: true},
        );
    });

    it("should remove the scratch root when copying fails so nothing is left behind", () => {
        // Arrange
        jest.spyOn(fs, "cpSync").mockImplementation(() => {
            throw new Error("copy failed");
        });
        const rmSyncSpy = jest.spyOn(fs, "rmSync");

        // Act
        try {
            createScratchRoot("/repo", "an_example");
        } catch {
            // The error is checked by the next test.
        }

        // Assert
        expect(rmSyncSpy).toHaveBeenCalledWith(
            "/real/checksync-conformance-abc",
            {recursive: true, force: true},
        );
    });

    it("should rethrow the error when copying fails", () => {
        // Arrange
        jest.spyOn(fs, "cpSync").mockImplementation(() => {
            throw new Error("copy failed");
        });

        // Act
        const underTest = () => createScratchRoot("/repo", "an_example");

        // Assert
        expect(underTest).toThrow("copy failed");
    });
});
