import path from "path";

import cwdRelativePath from "../cwd-relative-path";

jest.mock("path");

describe("#cwdRelativePath", () => {
    it("should resolve the path against the current directory", () => {
        // Arrange
        jest.spyOn(process, "cwd").mockReturnValue("PROCESS_CWD");
        const pathRelativeSpy = jest
            .spyOn(path, "relative")
            .mockReturnValue("RELATIVE_PATH");

        // Act
        const result = cwdRelativePath("MY_FILE");

        // Assert
        expect(result).toBe("RELATIVE_PATH");
        expect(pathRelativeSpy).toHaveBeenCalledWith("PROCESS_CWD", "MY_FILE");
    });
});
