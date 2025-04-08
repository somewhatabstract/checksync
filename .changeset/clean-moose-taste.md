---
"checksync": major
---

Removed the `includeDotPaths` config option and associated argument. It was a mistake. If you need a path that starts with a `.` to be included, explicitly list it in the `includeGlobs` configuration or the paths passed to the CLI command.
