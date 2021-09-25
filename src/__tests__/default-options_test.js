// @flow
describe("defaultOptions", () => {
    it("should set includeGlobs to all files under the current working directory", async () => {
        // Arrange
        jest.spyOn(process, "cwd").mockReturnValue("/");

        // Act
        const {
            default: {includeGlobs: result},
        } = await import("../default-options.js");

        // Assert
        expect(result).toContainAllValues(["/**"]);
    });

    it("should provide expected defaults", async () => {
        // Arrange
        jest.spyOn(process, "cwd").mockReturnValue("/");

        // Act
        const {default: result} = await import("../default-options.js");

        // Assert
        expect(result).toMatchInlineSnapshot(`
Object {
  "autoFix": false,
  "comments": Array [
    "#",
    "//",
    "{/*",
  ],
  "dryRun": false,
  "excludeGlobs": Array [],
  "ignoreFiles": Array [
    ".gitignore",
  ],
  "includeGlobs": Array [
    "/**",
  ],
  "json": false,
}
`);
    });
});
