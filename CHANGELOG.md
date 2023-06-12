# checksync

## 5.0.3

### Patch Changes

-   003a91a: Fix rollup config to bundle deps

## 5.0.2

### Patch Changes

-   7654f97: Add publishConfig

## 5.0.1

### Patch Changes

-   52ddefd: Updating some things to get automated changeset release working

## 5.0.0

### Major Changes

-   6b561be: Migrate to TypeScript

    Although there are no functional changes here, we are bumping the major version since changing our static types are provided from Flow to TypeScript could break some folks development setups.

-   14bbc5f: Working directory updates
    -   The location of the configuration file is now used as the current working directory, if a configuration file is used. This means that globs are resolved relative to the configuration file, not the current working directory of the process launching checksync, which makes for a more deterministic behavior for
        folks trying to define and use their config files.
    -   A `--cwd` argument has been added for specifying the working directory in cases where a configuration file is not used, or the configuration file discover needs to start in a place other than where checksync is invoked. If a configuration file is loaded, the location of that file takes precedence.
-   95d1a29: Update gitignore support to support full range of syntax. We now use the [`ignore`](https://www.npmjs.com/package/ignore) package to support the gitignore file syntax. New verbose logging has been added to help debug ignore file issues, too.

### Patch Changes

-   9534465: Improved console output to make things easier to read/scan
