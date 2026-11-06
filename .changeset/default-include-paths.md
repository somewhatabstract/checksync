---
"checksync": patch
---

Fix running checksync with no include paths. It now checks every file below the current working directory, as the help says, instead of failing with "No matching files". That includes the folder given by `--cwd`, and still holds when a configuration file is found in a folder above.
