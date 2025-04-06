import * as Ancesdir from "ancesdir";
import path from "path";

import {ancesdirOrCurrentDir} from "../ancesdir-or-currentdir";

jest.mock("ancesdir");

describe("ancesdirOrCurrentDir", () => {
    it("should start the search in the same folder as the given path", () => {
        // Arrange
        const ancesdirSpy = jest
            .spyOn(Ancesdir, "default")
            .mockReturnValue("ROOT");

        // Act
        ancesdirOrCurrentDir("FILE", "MARKER");

        // Assert - a fake dir is added so that ancesdir looks at its "parent"
        expect(ancesdirSpy).toHaveBeenCalledWith(
            `FILE${path.sep}__fake__`,
            "MARKER",
        );
    });

    it("should throw a useful error if ancesdir fails", () => {
        // Arrange
        jest.spyOn(Ancesdir, "default").mockImplementation(() => {
            throw new Error("Fake error");
        });

        // Act
        const underTest = () => ancesdirOrCurrentDir("FILE", "MARKER");

        // Assert
        expect(underTest).toThrowErrorMatchingInlineSnapshot(
            `"Unable to locate directory containing marker file "MARKER" from starting location "FILE""`,
        );
    });
});
