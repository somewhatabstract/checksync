import fs from "fs";

import checkGolden from "../check-golden";

jest.mock("fs");

describe("#checkGolden", () => {
    describe("when updating", () => {
        it("should write the transcript as the golden file", () => {
            // Arrange
            const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync");

            // Act
            checkGolden("/goldens/a/json.txt", "transcript", true);

            // Assert
            expect(writeFileSyncSpy).toHaveBeenCalledWith(
                "/goldens/a/json.txt",
                "transcript",
                "utf8",
            );
        });

        it("should create the golden file's directory so new examples can be recorded", () => {
            // Arrange
            const mkdirSyncSpy = jest.spyOn(fs, "mkdirSync");

            // Act
            checkGolden("/goldens/a/json.txt", "transcript", true);

            // Assert
            expect(mkdirSyncSpy).toHaveBeenCalledWith("/goldens/a", {
                recursive: true,
            });
        });

        it("should report that the golden was updated", () => {
            // Arrange

            // Act
            const result = checkGolden(
                "/goldens/a/json.txt",
                "transcript",
                true,
            );

            // Assert
            expect(result).toBe("updated");
        });
    });

    describe("when checking", () => {
        it("should report a missing golden file", () => {
            // Arrange
            jest.spyOn(fs, "existsSync").mockReturnValue(false);

            // Act
            const result = checkGolden(
                "/goldens/a/json.txt",
                "transcript",
                false,
            );

            // Assert
            expect(result).toBe("missing");
        });

        it("should report a match when the golden file has the same content", () => {
            // Arrange
            jest.spyOn(fs, "existsSync").mockReturnValue(true);
            jest.spyOn(fs, "readFileSync").mockReturnValue("transcript");

            // Act
            const result = checkGolden(
                "/goldens/a/json.txt",
                "transcript",
                false,
            );

            // Assert
            expect(result).toBe("match");
        });

        it("should report a mismatch when the golden file has different content", () => {
            // Arrange
            jest.spyOn(fs, "existsSync").mockReturnValue(true);
            jest.spyOn(fs, "readFileSync").mockReturnValue("old transcript");

            // Act
            const result = checkGolden(
                "/goldens/a/json.txt",
                "transcript",
                false,
            );

            // Assert
            expect(result).toBe("mismatch");
        });

        it("should write mismatched output next to the golden file so the two can be diffed", () => {
            // Arrange
            jest.spyOn(fs, "existsSync").mockReturnValue(true);
            jest.spyOn(fs, "readFileSync").mockReturnValue("old transcript");
            const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync");

            // Act
            checkGolden("/goldens/a/json.txt", "transcript", false);

            // Assert
            expect(writeFileSyncSpy).toHaveBeenCalledWith(
                "/goldens/a/json.actual.txt",
                "transcript",
                "utf8",
            );
        });
    });
});
