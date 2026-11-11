describe("defaultOptions", () => {
    const importDefaultOptions = () => {
        // @ts-expect-error We don't care about needing an extension here.
        // It'll be fine without it.
        return import("../default-options");
    };

    it("should set includeGlobs to everything below the working directory", async () => {
        // Arrange

        // Act
        const {
            default: {includeGlobs: result},
        } = await importDefaultOptions();

        // Assert
        expect(result).toEqual(["**"]);
    });

    it("should provide expected defaults", async () => {
        // Arrange

        // Act
        const {default: result} = await importDefaultOptions();

        // Assert
        expect(result).toMatchInlineSnapshot(`
{
  "allowEmptyTags": false,
  "autoFix": false,
  "cacheMode": "ignore",
  "cachePath": "cache.json",
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
    "**",
  ],
  "json": false,
}
`);
    });
});
