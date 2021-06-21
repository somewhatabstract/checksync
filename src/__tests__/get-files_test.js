// @flow
import * as FastGlob from "fast-glob";
import Logger from "../logger.js";
import StringLogger from "../string-logger.js";

import getFiles from "../get-files.js";

jest.mock("fast-glob");
jest.mock("fs");

describe("#getFiles", () => {
    it("should expand foo format includes", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["foo"], [], [], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["**/foo/**", "foo"],
            expect.any(Object),
        );
    });

    it("should expand /foo format includes", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["/foo"], [], [], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            ["/foo/**", "/foo"],
            expect.any(Object),
        );
    });

    it("should expand /foo/ format includes", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["/foo/"], [], [], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["/foo/**"], expect.any(Object));
    });

    it("should expand foo/ format includes", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) => Promise.resolve([]));

        // Act
        await getFiles(["foo/"], [], [], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(["**/foo/**"], expect.any(Object));
    });

    it("should return a sorted list without duplicates", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        const result = await getFiles(
            ["pattern1", "pattern2"],
            [],
            [],
            NullLogger,
        );

        // Assert
        expect(result).toEqual(["a", "b", "c", "d"]);
        expect(globSpy).toHaveBeenCalledTimes(1);
    });

    it("should exclude files matched by exclude globs", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        const globSpy = jest
            .spyOn(FastGlob, "default")
            .mockImplementation((pattern, opts) =>
                Promise.resolve(["c", "a", "d", "b"]),
            );

        // Act
        await getFiles([], ["a", "c"], [], NullLogger);

        // Assert
        expect(globSpy).toHaveBeenCalledWith(
            [],
            expect.objectContaining({ignore: ["**/a/**", "a", "**/c/**", "c"]}),
        );
    });

    it("should log verbosely", async () => {
        // Arrange
        const NullLogger = new Logger(null);
        jest.spyOn(FastGlob, "default").mockImplementation((pattern, opts) =>
            Promise.resolve(["c", "a", "d", "b"]),
        );
        const verboseSpy = jest.spyOn(NullLogger, "verbose");

        // Act
        await getFiles([], ["a", "c"], [], NullLogger);

        // Assert
        expect(verboseSpy).toHaveBeenCalledTimes(3);
    });

    it("should log matching snapshot", async () => {
        // Arrange
        const logger = new StringLogger(true);
        jest.spyOn(FastGlob, "default").mockImplementation((pattern, opts) =>
            Promise.resolve(["c", "a", "d", "b"]),
        );

        // Act
        await getFiles([], ["a", "c"], [], logger);
        const log = logger.getLog();

        // Assert
        expect(log).toMatchSnapshot();
    });

    it.todo("should expand ignore files");
    // it("should combine exclude rules from given ignore files", () => {
    //     // Arrange
    //     const fakeParsedArgs = {
    //         ...defaultArgs,
    //         updateTags: true,
    //         ignoreFiles: "IGNOREFILEA,IGNOREFILEB",
    //         comments: "COMMENT1,COMMENT2",
    //         _: ["globs", "and globs"],
    //     };
    //     const checkSyncSpy = jest
    //         .spyOn(CheckSync, "default")
    //         .mockReturnValue({then: jest.fn()});
    //     jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
    //     jest.spyOn(ParseGitIgnore, "default").mockReturnValueOnce([
    //         "IGNORE1",
    //         "IGNORE2",
    //     ]);
    //     jest.spyOn(ParseGitIgnore, "default").mockReturnValueOnce([
    //         "IGNORE1",
    //         "IGNORE3",
    //     ]);

    //     // Act
    //     run(__filename);

    //     // Assert
    //     expect(checkSyncSpy).toHaveBeenCalledWith(
    //         {
    //             includeGlobs: fakeParsedArgs._,
    //             excludeGlobs: ["IGNORE1", "IGNORE2", "IGNORE1", "IGNORE3"],
    //             dryRun: false,
    //             autoFix: true,
    //             comments: ["COMMENT1", "COMMENT2"],
    //             json: false,
    //             rootMarker: undefined,
    //         },
    //         expect.any(Object),
    //     );
    // });
});
