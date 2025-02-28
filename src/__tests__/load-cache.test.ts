import fs from "fs/promises";
import {loadCache} from "../load-cache";
import {ExitCode} from "../exit-codes";
import {ExitError} from "../exit-error";
import {osSeparators} from "../normalize-separators";

describe("loadCache", () => {
    it.each`
        cachePath
        ${"cache.json"}
        ${osSeparators("/<rootDir>/cache.json")}
    `(
        "should log the absolute cache file path for $cachePath",
        async ({cachePath}) => {
            // Arrange
            const log = {
                info: jest.fn(),
            } as any;
            jest.spyOn(process, "cwd").mockReturnValue("/<rootDir>");
            jest.spyOn(fs, "readFile").mockResolvedValue("{}");

            // Act
            await loadCache(cachePath, log);

            // Assert
            expect(log.info).toHaveBeenCalledWith(
                osSeparators(`Loading cache from /<rootDir>/cache.json`),
            );
        },
    );

    it("should load the cache file", async () => {
        // Arrange
        const log = {
            info: jest.fn(),
        } as any;
        const readFileSpy = jest.spyOn(fs, "readFile").mockResolvedValue("{}");

        // Act
        await loadCache("/<rootDir>/cache.json", log);

        // Assert
        expect(readFileSpy).toHaveBeenCalledWith(
            "/<rootDir>/cache.json",
            "utf8",
        );
    });

    it("should parse the JSON from the cache file", async () => {
        // Arrange
        const log = {
            info: jest.fn(),
        } as any;
        jest.spyOn(fs, "readFile").mockResolvedValue('{"key":"value"}');
        const jsonParseSpy = jest.spyOn(JSON, "parse");

        // Act
        await loadCache("/<rootDir>/cache.json", log);

        // Assert
        expect(jsonParseSpy).toHaveBeenCalledWith('{"key":"value"}');
    });

    it("should return the loaded JSON", async () => {
        // Arrange
        const log = {
            info: jest.fn(),
        } as any;
        jest.spyOn(fs, "readFile").mockResolvedValue('{"key":"value"}');

        // Act
        const result = await loadCache("/<rootDir>/cache.json", log);

        // Assert
        expect(result).toEqual({key: "value"});
    });

    it("should throw BAD_CACHE exit error if the file cannot be loaded", async () => {
        // Arrange
        const log = {
            info: jest.fn(),
        } as any;
        jest.spyOn(fs, "readFile").mockRejectedValue(
            new Error("File not found"),
        );

        // Act
        let error: ExitError | undefined;
        await loadCache("/<rootDir>/cache.json", log).catch((e) => (error = e));

        // Assert
        expect(error?.message).toBe(
            "Failed to load cache from /<rootDir>/cache.json",
        );
        expect(error?.exitCode).toBe(ExitCode.BAD_CACHE);
    });

    it("should throw BAD_CACHE exit error if the file cannot be parsed", async () => {
        // Arrange
        const log = {
            info: jest.fn(),
        } as any;
        jest.spyOn(fs, "readFile").mockResolvedValue("invalid JSON");

        // Act
        let error: ExitError | undefined;
        await loadCache("/<rootDir>/cache.json", log).catch((e) => (error = e));

        // Assert
        expect(error?.message).toBe(
            "Failed to load cache from /<rootDir>/cache.json",
        );
        expect(error?.exitCode).toBe(ExitCode.BAD_CACHE);
    });
});
