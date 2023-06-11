---
"checksync": major
---

- The location of the configuration file is now used as the current working directory, if a configuration file is used. This means that globs are resolved relative to the configuration file, not the current working directory of the process launching checksync, which makes for a more deterministic behavior for
folks trying to define and use their config files.
- A `--cwd` argument has been added for specifying the working directory in cases where a configuration file is not used, or the configuration file discover needs to start in a place other than where checksync is invoked. If a configuration file is loaded, the location of that file takes precedence.
