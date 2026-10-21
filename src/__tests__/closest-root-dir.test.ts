jest.mock("ancesdir");

describe("closestRootDir", () => {
    // The memo lives for the life of the module, so each test gets a fresh
    // copy of it, along with the copy of ancesdir that it uses.
    let Ancesdir: Pick<typeof import("ancesdir"), "closesdir">;
    let closestRootDir: typeof import("../closest-root-dir").default;
    beforeEach(async () => {
        await jest.isolateModulesAsync(async () => {
            Ancesdir = await import("ancesdir");
            ({default: closestRootDir} =
                // @ts-expect-error We don't care about needing an extension
                // here. It'll be fine without it.
                await import("../closest-root-dir"));
        });
    });

    it("should return the root found by ancesdir", () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir").mockReturnValue("/ROOT");

        // Act
        const result = closestRootDir("/ROOT/DIR", "MARKER");

        // Assert
        expect(result).toBe("/ROOT");
    });

    it("should start the search from the given directory so a marker in it is found", () => {
        // Arrange
        const closesdirSpy = jest
            .spyOn(Ancesdir, "closesdir")
            .mockReturnValue("/ROOT");

        // Act
        closestRootDir("/ROOT/DIR", "MARKER");

        // Assert
        expect(closesdirSpy).toHaveBeenCalledWith("/ROOT/DIR", "MARKER");
    });

    it("should look for the default marker when the marker is null", () => {
        // Arrange
        const closesdirSpy = jest
            .spyOn(Ancesdir, "closesdir")
            .mockReturnValue("/ROOT");

        // Act
        closestRootDir("/ROOT/DIR", null);

        // Assert
        expect(closesdirSpy).toHaveBeenCalledWith("/ROOT/DIR", undefined);
    });

    it("should not search again for a directory and marker it has already resolved", () => {
        // Arrange
        const closesdirSpy = jest
            .spyOn(Ancesdir, "closesdir")
            .mockReturnValue("/ROOT");
        closestRootDir("/ROOT/DIR", "MARKER");

        // Act
        closestRootDir("/ROOT/DIR", "MARKER");

        // Assert
        expect(closesdirSpy).toHaveBeenCalledTimes(1);
    });

    it("should return the remembered root for a directory and marker it has already resolved", () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir")
            .mockReturnValueOnce("/ROOT")
            .mockReturnValueOnce("/OTHER");
        closestRootDir("/ROOT/DIR", "MARKER");

        // Act
        const result = closestRootDir("/ROOT/DIR", "MARKER");

        // Assert
        expect(result).toBe("/ROOT");
    });

    it("should search separately for a different marker in the same directory", () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir")
            .mockReturnValueOnce("/ROOT")
            .mockReturnValueOnce("/ROOT/DIR");
        closestRootDir("/ROOT/DIR", "MARKER");

        // Act
        const result = closestRootDir("/ROOT/DIR", "OTHER_MARKER");

        // Assert
        expect(result).toBe("/ROOT/DIR");
    });

    it("should search separately for a different directory with the same marker", () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir")
            .mockReturnValueOnce("/ROOT")
            .mockReturnValueOnce("/OTHER_ROOT");
        closestRootDir("/ROOT/DIR", "MARKER");

        // Act
        const result = closestRootDir("/OTHER_ROOT/DIR", "MARKER");

        // Assert
        expect(result).toBe("/OTHER_ROOT");
    });

    it("should throw when ancesdir cannot find the marker", () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir").mockImplementation(() => {
            throw new Error("NOT FOUND");
        });

        // Act
        const act = () => closestRootDir("/ROOT/DIR", "MARKER");

        // Assert
        expect(act).toThrow("NOT FOUND");
    });

    it("should search again after a failed lookup in case the marker now exists", () => {
        // Arrange
        jest.spyOn(Ancesdir, "closesdir")
            .mockImplementationOnce(() => {
                throw new Error("NOT FOUND");
            })
            .mockReturnValueOnce("/ROOT");
        try {
            closestRootDir("/ROOT/DIR", "MARKER");
        } catch {
            // Expected; the first lookup fails.
        }

        // Act
        const result = closestRootDir("/ROOT/DIR", "MARKER");

        // Assert
        expect(result).toBe("/ROOT");
    });
});
