// @flow
import * as FastGlob from "fast-glob";

import getFiles from "../get-files.js";

jest.mock("fast-glob");
jest.mock("fs");

describe("#getFiles", () => {
    it("should expand foo format includes", async () => {
        // Arrange
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["foo"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["**/foo/**", "foo"],
            expect.any(Object),
        );
    });

    it("should expand /foo format includes", async () => {
        // Arrange
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["/foo"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["/foo/**", "/foo"],
            expect.any(Object),
        );
    });

    it("should expand /foo/ format includes", async () => {
        // Arrange
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["/foo/"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["/foo/**"], expect.any(Object));
    });

    it("should expand foo/ format includes", async () => {
        // Arrange
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["foo/"], []);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["**/foo/**"], expect.any(Object));
    });

    it("should return a sorted list without duplicates", async () => {
        // Arrange
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        const result = await getFiles(["pattern1", "pattern2"], []);

        // Assert
        expect(result).toEqual(["a", "b", "c", "d"]);
        expect(globSpy).toHaveBeenCalledTimes(1);
    });

    it("should exclude files matched by exclude globs", async () => {
        // Arrange
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        await getFiles([], ["a", "c"]);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            [],
            expect.objectContaining({ignore: ["**/a/**", "a", "**/c/**", "c"]}),
        );
    });
});
