// @flow
import Logger from "../logger.js";
import outputJson from "../output-json.js";
import {version} from "../../package.json";

import type {JsonItem, Options} from "../types.js";

jest.mock("../get-launch-string.js", () => () => "checksync");

describe("#outputJson", () => {
    it("should log a JSON string", () => {
        // Arrange
        const NullLogger = new Logger();
        const logSpy = jest.spyOn(NullLogger, "log");
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: "marker",
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        outputJson(options, NullLogger, [], []);

        // Assert
        const jsonStr = logSpy.mock.calls[0][0];
        expect(() => JSON.parse(jsonStr)).not.toThrow();
    });

    it("should include the version in the JSON string", () => {
        // Arrange
        const NullLogger = new Logger();
        const logSpy = jest.spyOn(NullLogger, "log");
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: "marker",
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        outputJson(options, NullLogger, [], []);

        // Assert
        const jsonObj = JSON.parse(logSpy.mock.calls[0][0]);
        expect(jsonObj.version).toEqual(version);
    });

    it("should include the command that was used to run checksync in the JSON string", () => {
        // Arrange
        const NullLogger = new Logger();
        const logSpy = jest.spyOn(NullLogger, "log");
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: "marker",
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };

        // Act
        outputJson(options, NullLogger, [], []);

        // Assert
        const jsonObj = JSON.parse(logSpy.mock.calls[0][0]);
        expect(jsonObj.launchString).toEqual("checksync");
    });

    it("should include all of the items were passed to it in the JSON string", () => {
        // Arrange
        const NullLogger = new Logger();
        const logSpy = jest.spyOn(NullLogger, "log");
        const options: Options = {
            includeGlobs: [],
            comments: [],
            autoFix: false,
            rootMarker: "marker",
            dryRun: false,
            excludeGlobs: [],
            json: false,
        };
        const violation: JsonItem = {
            type: "violation",
            sourceFile: "filea",
            sourceLine: 5,
            targetFile: "fileb",
            targetLine: 8,
            message: "Something went wrong",
        };

        // Act
        outputJson(options, NullLogger, [violation], []);

        // Assert
        const jsonObj = JSON.parse(logSpy.mock.calls[0][0]);
        expect(jsonObj.items).toEqual([violation]);
    });
});
