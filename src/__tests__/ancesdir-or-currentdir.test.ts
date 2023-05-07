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
});
