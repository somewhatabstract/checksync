describe("defaultOptions", () => {
    const importDefaultOptions = () => {
        // @ts-expect-error We don't care about needing an extension here.
        // It'll be fine without it.
        return import("../default-options");
    };

    it("should set includeGlobs to all files under the current working directory", async () => {
        // Arrange
        jest.spyOn(process, "cwd").mockReturnValue("/");

        // Act
        const {
            default: {includeGlobs: result},
        } = await importDefaultOptions();

        // Assert
        expect(result).toContainAllValues(["/**"]);
    });

    it("should provide expected defaults", async () => {
        // Arrange
        jest.spyOn(process, "cwd").mockReturnValue("/");

        // Act
        const {default: result} = await importDefaultOptions();

        // Assert
        expect(result).toMatchInlineSnapshot(`
            {
              "autoFix": false,
              "comments": [
                "#",
                "//",
                "{/*",
              ],
              "dryRun": false,
              "excludeGlobs": [],
              "ignoreFiles": [
                ".gitignore",
              ],
              "includeGlobs": [
                "/**",
              ],
              "json": false,
            }
        `);
    });
});
