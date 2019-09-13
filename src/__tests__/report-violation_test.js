// @flow
import reportViolation from "../report-violation.js";
import Format from "../format.js";
import Logger from "../logger.js";

jest.mock("../format.js");

describe("#reportViolation", () => {
    it("should report violation", () => {
        // Arrange
        const NullLogger = new Logger();
        const violationSpy = jest
            .spyOn(Format, "violation")
            .mockReturnValue("FORMATTED_VIOLATION");
        jest.spyOn(Format, "filePath").mockReturnValue("FORMATTED_FILE");
        const logSpy = jest.spyOn(NullLogger, "log");

        // Act
        reportViolation(
            "marker1",
            "sourceFile",
            "sourceLine",
            "sourceChecksum",
            "targetFile",
            "targetLine",
            "targetChecksum",
            NullLogger,
        );

        // Assert
        expect(violationSpy).toHaveBeenCalledWith(
            expect.stringContaining("FORMATTED_FILE"),
        );
        expect(logSpy).toHaveBeenCalledWith("FORMATTED_VIOLATION");
    });

    it("should report no checksum if source checksum absent", () => {
        // Arrange
        const NullLogger = new Logger();
        const violationSpy = jest
            .spyOn(Format, "violation")
            .mockReturnValue("FORMATTED_VIOLATION");
        // Act
        reportViolation(
            "marker1",
            "sourceFile",
            "sourceLine",
            null,
            "targetFile",
            "targetLine",
            "targetChecksum",
            NullLogger,
        );

        // Assert
        expect(violationSpy).toHaveBeenCalledWith(
            expect.stringContaining("No checksum != targetChecksum"),
        );
    });

    it("should report no checksum if target checksum absent", () => {
        // Arrange
        const NullLogger = new Logger();
        const violationSpy = jest
            .spyOn(Format, "violation")
            .mockReturnValue("FORMATTED_VIOLATION");
        // Act
        reportViolation(
            "marker1",
            "sourceFile",
            "sourceLine",
            "sourceChecksum",
            "targetFile",
            "targetLine",
            null,
            NullLogger,
        );

        // Assert
        expect(violationSpy).toHaveBeenCalledWith(
            expect.stringContaining("sourceChecksum != No checksum"),
        );
    });

    it("should out target file and line reference", () => {
        // Arrange
        const NullLogger = new Logger();
        const violationSpy = jest
            .spyOn(Format, "violation")
            .mockReturnValue("FORMATTED_VIOLATION");
        // Act
        reportViolation(
            "marker1",
            "sourceFile",
            "sourceLine",
            "sourceChecksum",
            "targetFile",
            "targetLine",
            null,
            NullLogger,
        );

        // Assert
        expect(violationSpy).toHaveBeenCalledWith(
            expect.stringContaining("targetFile:targetLine"),
        );
    });
});
