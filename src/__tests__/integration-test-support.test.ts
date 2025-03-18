import fs from "fs";
import {
    getExamples,
    runChecksync,
    writeLog,
    readLog,
    Scenario,
} from "../integration-test-support";
import * as Checksync from "../check-sync";
import * as GetLaunchString from "../get-launch-string";
import {ExitCode} from "../exit-codes";
import StringLogger from "../string-logger";

describe("integration-test-support", () => {
    beforeEach(() => {
        // Have to make sure to clear mocks since we're using jest.mock.
        jest.clearAllMocks();
    });

    describe("getExamples", () => {
        const platform = process.platform;
        afterEach(() => {
            Object.defineProperty(process, "platform", {
                value: platform,
            });
        });

        it("should get the examples from the __examples__ folder", () => {
            // Arrange
            const readdirSyncSpy = jest
                .spyOn(fs, "readdirSync")
                .mockReturnValueOnce([]);

            // Act
            getExamples();

            // Assert
            expect(readdirSyncSpy).toHaveBeenCalledWith(
                expect.stringMatching(/__examples__$/),
            );
        });

        it("should only return directories", () => {
            // Arrange
            jest.spyOn(fs, "readdirSync").mockReturnValueOnce([
                "a_file",
                "b_dir",
                "c_file",
            ] as any);
            jest.spyOn(fs, "lstatSync").mockImplementation(
                (path) =>
                    ({
                        isDirectory: () => String(path).includes("dir"),
                    }) as any,
            );

            // Act
            const examples = getExamples();

            // Assert
            expect(examples).toEqual(["b_dir"]);
        });
    });

    describe("runChecksync", () => {
        it("should reject if the scenario is not recognized", async () => {
            // Arrange

            // Act
            const underTest = runChecksync("example", "BAD_SCENARIO" as any);

            // Assert
            await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
                `"Unknown scenario: BAD_SCENARIO"`,
            );
        });

        it("should run checksync with a string logger instance", async () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(Checksync, "default")
                .mockResolvedValueOnce(ExitCode.SUCCESS);

            // Act
            await runChecksync("example", Scenario.CheckOnly);

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(StringLogger),
            );
        });

        it("should run checksync in cache write mode for the given example", async () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(Checksync, "default")
                .mockResolvedValueOnce(ExitCode.SUCCESS);

            // Act
            await runChecksync("example");

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    cachePath: expect.stringContaining("example.json"),
                    cacheMode: "write",
                }),
                expect.any(StringLogger),
            );
        });

        it("should run checksync with the glob for the given example", async () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(Checksync, "default")
                .mockResolvedValueOnce(ExitCode.SUCCESS);

            // Act
            await runChecksync("example", Scenario.CheckOnly);

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    includeGlobs: ["**/example/**"],
                }),
                expect.any(StringLogger),
            );
        });

        it("should run checksync with JSON output turned on for the json-check-only scenario", async () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(Checksync, "default")
                .mockResolvedValueOnce(ExitCode.SUCCESS);

            // Act
            await runChecksync("example", Scenario.JsonCheckOnly);

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    json: true,
                }),
                expect.any(StringLogger),
            );
        });

        it("should run checksync with autofix and dry-run turned on for the autofix scenario", async () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(Checksync, "default")
                .mockResolvedValueOnce(ExitCode.SUCCESS);

            // Act
            await runChecksync("example", Scenario.Autofix);

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    autoFix: true,
                    dryRun: true,
                }),
                expect.any(StringLogger),
            );
        });

        it("should run checkSync with migration mode all when example is `migrate_all` example", async () => {
            // Arrange
            const checkSyncSpy = jest
                .spyOn(Checksync, "default")
                .mockResolvedValueOnce(ExitCode.SUCCESS);

            // Act
            await runChecksync("migrate_all", Scenario.CheckOnly);

            // Assert
            expect(checkSyncSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    migration: expect.objectContaining({
                        mode: "all",
                    }),
                }),
                expect.any(StringLogger),
            );
        });
    });

    describe("writeLog", () => {
        it.each`
            example                                     | scenario                  | fileName
            ${"example"}                                | ${Scenario.CheckOnly}     | ${"example.check-only.log"}
            ${"example-with-123 replaceable /// chars"} | ${Scenario.JsonCheckOnly} | ${"example_with_123_replaceable_____chars.json-check-only.log"}
            ${"example3"}                               | ${Scenario.Autofix}       | ${"example3.autofix.log"}
        `(
            "should attempt to read the log $fileName for the example $example and scenario $scenario",
            async ({example, scenario, fileName}) => {
                // Arrange
                const writeFileSpy = jest
                    .spyOn(fs, "writeFile")
                    .mockImplementation(((_: any, __: any, cb: any) => {
                        cb(null);
                    }) as any);

                // Act
                await writeLog(example, scenario, "LOG_CONTENT");

                // Assert
                expect(writeFileSpy).toHaveBeenCalledWith(
                    expect.stringContaining(fileName),
                    "LOG_CONTENT",
                    expect.any(Function),
                );
            },
        );

        it("should reject if there is an error writing the log file", async () => {
            // Arrange
            jest.spyOn(fs, "writeFile").mockImplementation(((
                _: any,
                __: any,
                cb: any,
            ) => {
                const err: any = new Error("BAD THINGS");
                err.code = "SOMETHING_BAD";
                cb(err);
            }) as any);

            // Act
            const underTest = writeLog(
                "example",
                Scenario.CheckOnly,
                "LOG_CONTENT",
            );

            // Assert
            await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
                `"BAD THINGS"`,
            );
        });

        it("should replace the version JSON", async () => {
            // Arrange
            const writeFileSpy = jest
                .spyOn(fs, "writeFile")
                .mockImplementation(((_: any, __: any, cb: any) => {
                    cb(null);
                }) as any);

            // Act
            await writeLog(
                "example",
                Scenario.JsonCheckOnly,
                '{ "version": "999.9.99" }',
            );

            // Assert
            expect(writeFileSpy).toHaveBeenCalledWith(
                expect.any(String),
                '{ "version": "0.0.0" }',
                expect.any(Function),
            );
        });

        it("should replace the launch string", async () => {
            // Arrange
            const writeFileSpy = jest
                .spyOn(fs, "writeFile")
                .mockImplementation(((_: any, __: any, cb: any) => {
                    cb(null);
                }) as any);

            jest.spyOn(GetLaunchString, "default").mockReturnValue(
                "LAUNCH_STRING",
            );

            // Act
            await writeLog(
                "example",
                Scenario.Autofix,
                "LAUNCH_STRING and some stuff",
            );

            // Assert
            expect(writeFileSpy).toHaveBeenCalledWith(
                expect.any(String),
                "checksync and some stuff",
                expect.any(Function),
            );
        });
    });

    describe("readLog", () => {
        it.each`
            example                                     | scenario                  | fileName
            ${"example"}                                | ${Scenario.CheckOnly}     | ${"example.check-only.log"}
            ${"example-with-123 replaceable /// chars"} | ${Scenario.JsonCheckOnly} | ${"example_with_123_replaceable_____chars.json-check-only.log"}
            ${"example3"}                               | ${Scenario.Autofix}       | ${"example3.autofix.log"}
        `(
            "should attempt to read the log $fileName for the example $example and scenario $scenario",
            async ({example, scenario, fileName}) => {
                // Arrange
                const readFileSpy = jest
                    .spyOn(fs, "readFile")
                    .mockImplementation(((_: any, __: any, cb: any) => {
                        cb(null, "data");
                    }) as any);

                // Act
                await readLog(example, scenario);

                // Assert
                expect(readFileSpy).toHaveBeenCalledWith(
                    expect.stringContaining(fileName),
                    "utf-8",
                    expect.any(Function),
                );
            },
        );

        it("should resolve null if the log for the given example and scenario does not exist", async () => {
            // Arrange
            jest.spyOn(fs, "readFile").mockImplementation(((
                _: any,
                __: any,
                cb: any,
            ) => {
                const err: any = new Error("ENOENT");
                err.code = "ENOENT";
                cb(err);
            }) as any);

            // Act
            const log = await readLog("example", Scenario.CheckOnly);

            // Assert
            expect(log).toBeNull();
        });

        it("should reject if there is an error reading the log file", async () => {
            // Arrange
            jest.spyOn(fs, "readFile").mockImplementation(((
                _: any,
                __: any,
                cb: any,
            ) => {
                const err: any = new Error("BAD THINGS");
                err.code = "SOMETHING_BAD";
                cb(err);
            }) as any);

            // Act
            const underTest = readLog("example", Scenario.CheckOnly);

            // Assert
            await expect(underTest).rejects.toThrowErrorMatchingInlineSnapshot(
                `"BAD THINGS"`,
            );
        });

        it("should resolve to the contents of the log file for the given example and scenario", async () => {
            // Arrange
            jest.spyOn(fs, "readFile").mockImplementation(((
                _: any,
                __: any,
                cb: any,
            ) => {
                cb(null, "log contents");
            }) as any);

            // Act
            const log = await readLog("example", Scenario.CheckOnly);

            // Assert
            expect(log).toBe("log contents");
        });
    });
});
