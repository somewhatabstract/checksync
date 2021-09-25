// @flow
import Logger from "../logger.js";
import * as FindConfigurationFile from "../find-configuration-file.js";
import * as LoadConfigurationFile from "../load-configuration-file.js";
import * as OptionsFromArgs from "../options-from-args.js";

import determineOptions from "../determine-options.js";
import defaultOptions from "../default-options.js";

jest.mock("../find-configuration-file.js");
jest.mock("../load-configuration-file.js");
jest.mock("../options-from-args.js");

describe("#determineOptions", () => {
    it("should convert args to options", async () => {
        // Arrange
        const optionsSpy = jest.spyOn(OptionsFromArgs, "optionsFromArgs");
        const args = {
            _: ["foo"],
            updateTags: true,
            config: false,
        };
        const NullLogger = new Logger(null, true);

        // Act
        await determineOptions(args, NullLogger);

        // Assert
        expect(optionsSpy).toHaveBeenCalledWith(args);
    });

    describe("when config argument is false", () => {
        it("should not search for a configuration file", async () => {
            // Arrange;
            const findConfigSpy = jest.spyOn(FindConfigurationFile, "default");
            const args = {
                _: ["foo"],
                config: false,
            };
            const NullLogger = new Logger(null, true);

            // Act
            await determineOptions(args, NullLogger);

            // Assert
            expect(findConfigSpy).not.toHaveBeenCalled();
        });

        it("should not load a configuration file", () => {
            // Arrange
            const loadConfigSpy = jest.spyOn(LoadConfigurationFile, "default");
            const args = {
                _: ["foo"],
                config: false,
            };
            const NullLogger = new Logger(null, true);

            // Act
            determineOptions(args, NullLogger);

            // Assert
            expect(loadConfigSpy).not.toHaveBeenCalled();
        });

        it("should return the given arguments, combined with the default options", async () => {
            // Arrange
            const argsOptions = {
                autoFix: true,
                includeGlobs: ["foo"],
            };
            jest.spyOn(OptionsFromArgs, "optionsFromArgs").mockReturnValue(
                argsOptions,
            );
            const args = {
                _: ["foo"],
                config: false,
            };
            const NullLogger = new Logger(null, true);

            // Act
            const result = await determineOptions(args, NullLogger);

            // Assert
            expect(result).toEqual({
                ...defaultOptions,
                ...argsOptions,
            });
        });
    });

    describe("when config argument is falsy but not false", () => {
        it("should search for a config file", async () => {
            // Arrange
            const findConfigSpy = jest.spyOn(FindConfigurationFile, "default");
            const args = {
                _: ["foo"],
                rootMarker: "root",
            };
            const NullLogger = new Logger(null, true);

            // Act
            await determineOptions(args, NullLogger);

            // Assert
            expect(findConfigSpy).toHaveBeenCalledWith("root", NullLogger);
        });

        it("should attempt to load the found config file", async () => {
            // Arrange
            jest.spyOn(FindConfigurationFile, "default").mockReturnValue(
                "/path/to/config/file",
            );
            const loadConfigSpy = jest.spyOn(LoadConfigurationFile, "default");
            const args = {
                _: ["foo"],
                rootMarker: "root",
            };
            const NullLogger = new Logger(null, true);

            // Act
            await determineOptions(args, NullLogger);

            // Assert
            expect(loadConfigSpy).toHaveBeenCalledWith(
                "/path/to/config/file",
                NullLogger,
            );
        });

        it("should return options with default at the lowest precedence, then config file, then arguments", async () => {
            // Arrange
            const argsOptions = {
                rootMarker: "root",
                includeGlobs: ["foo"],
            };
            jest.spyOn(OptionsFromArgs, "optionsFromArgs").mockReturnValue(
                argsOptions,
            );
            jest.spyOn(FindConfigurationFile, "default").mockReturnValue(
                "/path/to/config/file",
            );
            const loadedOptions = {
                rootMarker: "loaded_root",
                autoFix: true,
            };
            jest.spyOn(LoadConfigurationFile, "default").mockResolvedValue(
                loadedOptions,
            );
            const args = {
                _: ["foo"],
            };
            const NullLogger = new Logger(null, true);

            // Act
            const result = await determineOptions(args, NullLogger);

            // Assert
            expect(result).toEqual({
                ...defaultOptions,
                ...loadedOptions,
                ...argsOptions,
            });
        });
    });

    describe("when config argument is truthy", () => {
        it("should not search for a configuration file", async () => {
            // Arrange
            const findConfigSpy = jest.spyOn(FindConfigurationFile, "default");
            const args = {
                _: ["foo"],
                config: "/path/to/config/file",
            };
            const NullLogger = new Logger(null, true);

            // Act
            await determineOptions(args, NullLogger);

            // Assert
            expect(findConfigSpy).not.toHaveBeenCalled();
        });

        it("should attempt to load the given configuration file", async () => {
            // Arrange
            const loadConfigSpy = jest.spyOn(LoadConfigurationFile, "default");
            const args = {
                _: ["foo"],
                config: "/path/to/config/file",
            };
            const NullLogger = new Logger(null, true);

            // Act
            await determineOptions(args, NullLogger);

            // Assert
            expect(loadConfigSpy).toHaveBeenCalledWith(
                "/path/to/config/file",
                NullLogger,
            );
        });

        it("should return options with default at the lowest precedence, then config file, then arguments", async () => {
            // Arrange
            const argsOptions = {
                rootMarker: "root",
                autoFix: false,
                ignoreFiles: ["bar"],
                includeGlobs: ["foo"],
            };
            jest.spyOn(OptionsFromArgs, "optionsFromArgs").mockReturnValue(
                argsOptions,
            );
            const loadedOptions = {
                rootMarker: "loaded_root",
                autoFix: true,
                comments: ["#"],
            };
            jest.spyOn(LoadConfigurationFile, "default").mockResolvedValue(
                loadedOptions,
            );
            const args = {
                _: ["foo"],
                config: "/path/to/config/file",
            };
            const NullLogger = new Logger(null, true);

            // Act
            const result = await determineOptions(args, NullLogger);

            // Assert
            expect(result).toEqual({
                ...defaultOptions,
                ...loadedOptions,
                ...argsOptions,
            });
        });
    });
});
