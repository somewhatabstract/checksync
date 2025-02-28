import fs from "fs/promises";
import {outputCache} from "../output-cache";
import {ExitCode} from "../exit-codes";
import {osSeparators} from "../normalize-separators";

describe("outputCache", () => {
    describe("with JSON flag", () => {
        it("should log the JSON", async () => {
            // Arrange
            const log = {
                log: jest.fn(),
            } as any;

            // Act
            await outputCache(
                {json: true, cacheMode: "write", cachePath: ""} as any,
                {foo: "bar"} as any,
                log,
            );

            // Assert
            expect(log.log).toHaveBeenCalledWith('{"foo":"bar"}');
        });

        it("should log if an error occurs", async () => {
            // Arrange
            const log = {
                log: jest.fn(),
                error: jest.fn(),
            } as any;
            jest.spyOn(JSON, "stringify").mockImplementation(() => {
                throw new Error("Unexpected error");
            });

            // Act
            await outputCache(
                {json: true, cacheMode: "write", cachePath: ""} as any,
                null as any,
                log,
            );

            // Assert
            expect(log.error).toHaveBeenCalledWith("Unable to output cache");
        });

        it("should return CATASTROPHIC if an error occurs", async () => {
            // Arrange
            const log = {
                log: jest.fn(),
                error: jest.fn(),
            } as any;
            jest.spyOn(JSON, "stringify").mockImplementation(() => {
                throw new Error("Unexpected error");
            });

            // Act
            const result = await outputCache(
                {json: true, cacheMode: "write", cachePath: ""} as any,
                null as any,
                log,
            );

            // Assert
            expect(result).toBe(ExitCode.CATASTROPHIC);
        });
    });

    describe("without JSON flag", () => {
        it.each`
            cachePath
            ${"cache.json"}
            ${"/<rootDir>/cache.json"}
        `(
            "should write the JSON to the absolute cache path of $cachePath",
            async ({cachePath}) => {
                // Arrange
                const log = {
                    info: jest.fn(),
                } as any;
                const writeFileSpy = jest
                    .spyOn(fs, "writeFile")
                    .mockResolvedValue();
                jest.spyOn(process, "cwd").mockReturnValue("/<rootDir>");

                // Act
                await outputCache(
                    {cacheMode: "write", cachePath} as any,
                    {foo: "bar"} as any,
                    log,
                );

                // Assert
                expect(writeFileSpy).toHaveBeenCalledWith(
                    osSeparators("/<rootDir>/cache.json"),
                    '{"foo":"bar"}',
                    "utf8",
                );
            },
        );

        it.each`
            cachePath
            ${"cache.json"}
            ${"/<rootDir>/cache.json"}
        `(
            "should log that the cache has been written to the absolute cache path of $cachePath",
            async ({cachePath}) => {
                // Arrange
                const log = {
                    info: jest.fn(),
                } as any;
                jest.spyOn(fs, "writeFile").mockResolvedValue();
                jest.spyOn(process, "cwd").mockReturnValue("/<rootDir>");

                // Act
                await outputCache(
                    {cacheMode: "write", cachePath} as any,
                    {foo: "bar"} as any,
                    log,
                );

                // Assert
                expect(log.info).toHaveBeenCalledWith(
                    osSeparators(`Cache written to /<rootDir>/cache.json`),
                );
            },
        );

        it("should log if an unexpected error occurs", async () => {
            // Arrange
            const log = {
                info: jest.fn(),
                error: jest.fn(),
            } as any;
            jest.spyOn(fs, "writeFile").mockRejectedValue(
                new Error("Unexpected"),
            );

            // Act
            await outputCache(
                {cacheMode: "write", cachePath: "/<rootDir>/cache.json"} as any,
                {foo: "bar"} as any,
                log,
            );

            // Assert
            expect(log.error).toHaveBeenCalledWith("Unable to output cache");
        });

        it("should return CATASTROPHIC if an unexpected error occurs", async () => {
            // Arrange
            const log = {
                info: jest.fn(),
                error: jest.fn(),
            } as any;
            jest.spyOn(fs, "writeFile").mockRejectedValue(
                new Error("Unexpected"),
            );

            // Act
            const result = await outputCache(
                {cacheMode: "write", cachePath: "/<rootDir>/cache.json"} as any,
                {foo: "bar"} as any,
                log,
            );

            // Assert
            expect(result).toBe(ExitCode.CATASTROPHIC);
        });
    });
});
