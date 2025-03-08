import path from "path";
import * as CwdRelativePath from "../cwd-relative-path";

import getLaunchString from "../get-launch-string";

jest.mock("path");
jest.mock("../cwd-relative-path");

describe("#getLaunchString", () => {
    it("should get the cwd relative path of the command", () => {
        // Arrange
        const spyCwdRelativePath = jest
            .spyOn(CwdRelativePath, "default")
            .mockReturnValueOnce("the_path");

        // Act
        getLaunchString();

        // Assert
        expect(spyCwdRelativePath).toHaveBeenCalledTimes(1);
    });

    it("should return relative path if not run as .bin/checksync", () => {
        // Arrange
        jest.spyOn(path, "join").mockReturnValueOnce(".bin/checksync");
        jest.spyOn(CwdRelativePath, "default").mockReturnValueOnce("the_path");

        // Act
        const result = getLaunchString();

        // Assert
        expect(result).toBe("the_path");
    });

    describe("if run as .bin/checksync", () => {
        beforeEach(() => {
            process.env.bkp_npm_execpath = process.env.npm_execpath;
            delete process.env.npm_execpath;
        });

        afterEach(() => {
            process.env.npm_execpath = process.env.bkp_npm_execpath;
            delete process.env.bkp_npm_execpath;
        });

        it("and npm_execpath contains yarn, should return `yarn checksync`", () => {
            // Arrange
            jest.spyOn(path, "join").mockReturnValueOnce(".bin/checksync");
            jest.spyOn(CwdRelativePath, "default").mockReturnValueOnce(
                "the_path/.bin/checksync",
            );
            process.env.npm_execpath = "yarn";

            // Act
            const result = getLaunchString();

            // Assert
            expect(result).toBe("yarn checksync");
        });

        it("and npm_execpath contains pnpm, should return `pnpm checksync`", () => {
            // Arrange
            jest.spyOn(path, "join").mockReturnValueOnce(".bin/checksync");
            jest.spyOn(CwdRelativePath, "default").mockReturnValueOnce(
                "the_path/.bin/checksync",
            );
            process.env.npm_execpath = "pnpm";

            // Act
            const result = getLaunchString();

            // Assert
            expect(result).toBe("pnpm checksync");
        });

        it("and npm_execpath is not yarn nor pnpm, should return `npx checksync`", () => {
            // Arrange
            jest.spyOn(path, "join").mockReturnValueOnce(".bin/checksync");
            jest.spyOn(CwdRelativePath, "default").mockReturnValueOnce(
                "the_path/.bin/checksync",
            );

            // Act
            const result = getLaunchString();

            // Assert
            expect(result).toBe("npx checksync");
        });
    });
});
