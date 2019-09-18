// @flow
import * as minimist from "minimist";

import {run} from "../cli.js";
import * as CheckSync from "../check-sync.js";

jest.mock("minimist");

describe("#run", () => {
    it("should parse args", () => {
        // Arrange
        const fakeParsedArgs = {
            fix: false,
            comments: "//,#",
        };
        jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
        const minimistSpy = jest
            .spyOn(minimist, "default")
            .mockReturnValue(fakeParsedArgs);

        // Act
        run(__filename);

        // Arrange
        expect(minimistSpy).toHaveBeenCalledWith(
            process.argv,
            expect.any(Object),
        );
    });

    it("should invoke checkSync with parsed args", () => {
        // Arrange
        const fakeParsedArgs = {
            updateTags: true,
            comments: "COMMENT1,COMMENT2",
            _: ["globs", "and globs"],
        };
        const checkSyncSpy = jest
            .spyOn(CheckSync, "default")
            .mockReturnValue({then: jest.fn()});
        jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);

        // Act
        run(__filename);

        // Arrange
        expect(checkSyncSpy).toHaveBeenCalledWith(
            {
                globs: fakeParsedArgs._,
                autoFix: true,
                comments: ["COMMENT1", "COMMENT2"],
            },
            expect.any(Object),
        );
    });

    describe("unknown arg handling", () => {
        it("should return false for process.execPath", () => {
            // Arrange
            const fakeParsedArgs = {
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler(process.execPath);

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for the given launchfile path", () => {
            // Arrange
            const fakeParsedArgs = {
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler(__filename);

            // Assert
            expect(result).toBeFalse();
        });

        it("should return false for .bin command", () => {
            // Arrange
            const fakeParsedArgs = {
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("/Some/Path/To/.bin/checksync");

            // Assert
            expect(result).toBeFalse();
        });

        it("should return true for other things", () => {
            // Arrange
            const fakeParsedArgs = {
                fix: false,
                comments: "//,#",
            };
            jest.spyOn(CheckSync, "default").mockReturnValue({then: jest.fn()});
            const minimistSpy = jest
                .spyOn(minimist, "default")
                .mockReturnValue(fakeParsedArgs);
            run(__filename);
            const unknownHandler = minimistSpy.mock.calls[0][1].unknown;

            // Act
            const result = unknownHandler("somethingelse");

            // Assert
            expect(result).toBeTrue();
        });

        it("should exit process with given exit code", () => {
            // Arrange
            const fakeParsedArgs = {
                fix: false,
                comments: "//,#",
            };
            const thenMock = jest.fn();
            jest.spyOn(CheckSync, "default").mockReturnValue({then: thenMock});
            jest.spyOn(minimist, "default").mockReturnValue(fakeParsedArgs);
            const exitSpy = jest
                .spyOn(process, "exit")
                .mockImplementation(jest.fn());
            run(__filename);
            const thenHandler = thenMock.mock.calls[0][0];

            // Act
            thenHandler(99);

            // Assert
            expect(exitSpy).toHaveBeenCalledWith(99);
        });
    });
});
